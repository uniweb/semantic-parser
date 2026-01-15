// import JSON5 from 'json5';
import Profile from './profile';
import isEqual from 'lodash.isequal';

export default class Article {
    constructor(data, options) {
        data ??= {};

        this.options = options;

        const input = options.input || {};

        this.profile = options.mainProfile;
        this.secondaryProfile = input.profiles?.[0] || null;
        this.profiles = input.profiles;
        this.section = input.section;
        this.field = input.field;

        this.format = input.format || {};

        const { website } = options;

        const { manual, global, report } = this.format;

        this.items = null;

        this.processor = website.getTemplateEngine();

        if (report) {
            let { select, filter } = report;

            if (select) {
                this.items = this.getSectionItems(select);

                this.section = select;

                if (filter && Array.isArray(this.items)) {
                    // replace variables in filter with global variables in outputParams
                    const globalVars = website.outputParams || {};
                    const regexp = /__([^_][^]*?)__/g;
                    if (regexp.test(filter)) {
                        filter = filter.replace(regexp, (_, key) => {
                            if (
                                key in globalVars &&
                                globalVars[key] !== null &&
                                globalVars[key] !== undefined
                            ) {
                                return `"${globalVars[key]}"`;
                            }
                            return 'undefined';
                        });
                    }

                    this.items = this.items.filter((item) =>
                        this.processor.evaluateText(filter, (key) => item[key])
                    );
                }
            }
        }

        if (manual) {
            if (!this.parseWithAutoItems(data)) {
                if (this.items) {
                    let parsedData = null;

                    //Single Item Section
                    if (!Array.isArray(this.items)) {
                        parsedData = this.instantiateContent(data, this.items);
                    } else {
                        parsedData = this.instantiateContent(data, {
                            _items: this.items,
                            _count: this.items.length,
                        });
                    }

                    this.content = parsedData;

                    this.elements = Article.splitItems(parsedData?.['content'] || []);

                    this.parsed = this.parse(this.elements);
                } else {
                    const parsedData = this.instantiateData(data);
                    this.content = parsedData;

                    this.elements = Article.splitItems(parsedData?.['content'] || []);

                    this.parsed = this.parse(this.elements);
                }
            }
        } else {
            //If there is report settings, we need to somehow manipulate the data
            // with given report settings
            const parsedData = global ? this.instantiateData(data) : data;
            this.content = parsedData;

            this.elements = Article.splitItems(parsedData?.['content'] || []);

            this.parsed = this.parse(this.elements);
        }
    }

    parseWithAutoItems(data) {
        const elements = Article.splitItems(data?.['content'] || []);

        if (elements.length === 2) {
            const [primary, secondary] = elements;

            // let secondaryText = JSON.stringify(secondary);
            // const regex = /\{\{(@?\w+[_\w@\.\/]*)\}\}/g;
            // const regex = /{{([^{}]*)}}/g;

            // if (regex.test(secondaryText)) {
            // let primaryText = JSON.stringify(primary);

            // let parsedPrimary = JSON.parse(this.instantiateText(primaryText));

            let parsedPrimary = this.instantiateContent(primary);
            let items = [];

            if (this.items) {
                if (!Array.isArray(this.items)) {
                    this.items = [this.items];
                }

                items = this.items.map((item, i) => {
                    return this.instantiateContent(secondary, {
                        ...item,
                        _items: this.items,
                        _item: item,
                        _index: i,
                        _count: this.items.length,
                    });
                });
            } else if (this.profiles.length) {
                if (this.section) {
                    //build items from section items

                    let section = this.section;

                    //clean section to get items from the section
                    this.section = '';
                    items = this.getSectionItems(`*${section}`) || [];

                    if (items.length) {
                        items = items.map((item) => {
                            return this.instantiateContent(secondary, item);
                        });
                    }
                } else {
                    //build items from profiles
                    items = this.profiles.map((profile) => {
                        return this.instantiateContent(secondary, profile);
                    });
                }
            }

            this.content = {
                type: 'doc',
                content: [...parsedPrimary, ...items.flat()],
            };

            this.elements = [parsedPrimary, ...items];

            this.parsed = this.parse(this.elements);

            this.autoItems = true;

            return true;
            // }
        }

        return false;
    }

    ///////////////////////////////////////////////////////////////////////////
    // STATIC METHODS

    static isEmptyItem(ele) {
        for (let i = 0; i < ele.length; i++) {
            let item = ele[i];

            const { type, content = [] } = item;

            if (type !== 'paragraph' || content.length) return false;
        }

        return true;
    }

    static splitItems(doc) {
        const elements = [];

        let ele = [];
        doc.forEach((item) => {
            const { type } = item;

            if (type === 'DividerBlock') {
                if (ele.length) {
                    elements.push([...ele]);
                } else {
                    elements.push([]);
                }

                ele = [];
            } else {
                ele.push(item);
            }
        });

        //Ignore end with divider
        if (ele.length && !Article.isEmptyItem(ele)) {
            elements.push([...ele]);
        }

        return elements;
    }

    static parseVideoBlock(itemAttrs) {
        let { src, caption = '', direction, info = {}, coverImg = {}, alt } = itemAttrs;

        const { identifier = '' } = info;

        let video = '';
        if (src) {
            video = src;
        } else if (identifier) {
            video =
                new uniweb.Profile(`docufolio/profile`, '_template').getAssetInfo(identifier)
                    ?.src || '';
        }

        let coverUrl = '';

        if (coverImg?.src) {
            coverUrl = coverImg.src;
        } else if (coverImg?.identifier) {
            coverUrl =
                new uniweb.Profile(`docufolio/profile`, '_template').getAssetInfo(
                    coverImg.identifier
                )?.src || '';
        }

        return {
            src: video,
            caption,
            direction,
            coverImg: coverUrl,
            alt,
        };
    }

    static parseIconBlock(itemAttrs) {
        let { svg } = itemAttrs;

        return svg;
    }

    static parseUniwebIcon(itemAttrs) {
        let { svg, url, size, color, preserveColors } = itemAttrs;

        return {
            svg,
            url,
            size,
            color,
            preserveColors,
        };
    }

    static parseDocumentBlock(itemAttrs) {
        let coverUrl = '';

        const { src, info = {}, coverImg = null, ...others } = itemAttrs;

        if (coverImg?.src) {
            coverUrl = coverImg.src;
        } else if (coverImg?.identifier) {
            coverUrl =
                new uniweb.Profile(`docufolio/profile`, '_template').getAssetInfo(
                    coverImg.identifier
                )?.src || '';
        }

        let ele = {
            ...others,
            coverImg: coverUrl,
        };

        if (src) {
            ele.href = src;
        } else {
            const { identifier = '' } = info;

            if (identifier) {
                ele.downloadUrl = new uniweb.Profile(`docufolio/profile`, '_template').getAssetInfo(
                    identifier
                );
            }
        }

        return ele;
    }

    static parseCardBlock(itemAttrs) {
        const { address, ...others } = itemAttrs;

        let parsedAddress = null;

        try {
            if (address) {
                parsedAddress = JSON.parse(address);
            }
        } catch {}

        let coverUrl = '';

        const { coverImg = null, icon } = others;

        if (coverImg?.src) {
            coverUrl = coverImg.src;
        } else if (coverImg?.identifier) {
            coverUrl =
                new uniweb.Profile(`docufolio/profile`, '_template').getAssetInfo(
                    coverImg.identifier
                )?.src || '';
        }

        if (icon) {
            others.icon = Article.parseUniwebIcon(icon);
        }

        return {
            ...others,
            address: parsedAddress,
            coverImg: coverUrl,
        };
    }

    parseImgBlock(itemAttrs) {
        let {
            info: imgInfo,
            targetId,
            caption = '',
            direction,
            filter,
            alt = '',
            url,
            href = '',
            theme,
            role,
            credit = '',
        } = itemAttrs;

        let { contentType, viewType, contentId, identifier } = imgInfo;

        const sizes = {
            center: 'basic',
            wide: 'lg',
            fill: 'full',
        };

        caption = Article.stripTags(caption);

        return {
            contentType,
            viewType,
            contentId: targetId || contentId,
            url,
            value: identifier || '',
            alt: alt || caption,
            caption,
            direction,
            filter,
            imgPos: direction === 'left' || direction === 'right' ? direction : '',
            size: sizes[direction] || 'basic',
            href,
            theme,
            role,
            credit,
        };
    }

    static parseCodeBlock(content) {
        let result = content
            .map((item) => {
                const { text } = item;

                return text;
            })
            .join(' ');

        // https://www.npmjs.com/package/json5
        try {
            result = JSON.parse(`${result}`);
        } catch (err) {
            result = result;
        }

        return result;
    }

    static parseFormBlock(itemAttrs) {
        const { data } = itemAttrs;

        if (!data) return null;

        let parsedData = data;

        if (typeof data === 'string') {
            try {
                parsedData = JSON.parse(data);
            } catch (err) {
                // console.warn('Error parsing FormBlock data:', err);
                parsedData = data;
            }
        }

        return parsedData;
    }

    parseHeading(content, body) {
        const text = content
            .map((item) => {
                const { text, marks = [], type } = item;

                if (type === 'hardBreak') return '<br>';
                else if (type === 'UniwebIcon') {
                    if (body && body.icons) body.icons.push(Article.parseUniwebIcon(item.attrs));
                    return '';
                }

                if (!marks.length) return text;

                let result = text;

                marks.forEach((mark) => {
                    let { type } = mark;

                    if (type === 'link') {
                        const linkAttrs = mark?.attrs || {};

                        const { href, target } = linkAttrs;

                        const fileExtensions = [
                            'pdf',
                            'doc',
                            'docx',
                            'xls',
                            'xlsx',
                            'ppt',
                            'pptx',
                            'jpg',
                            'svg',
                            'jpeg',
                            'png',
                            'webp',
                            'gif',
                            'mp4',
                            'mp3',
                            'wav',
                            'mov',
                            'zip',
                        ];

                        // Extract the extension from the href
                        const extension = href.split('.').pop().toLowerCase();

                        // Check if the extracted extension matches any known file extensions
                        const isFileLink = fileExtensions.includes(extension);

                        result = `<a target="${target}" href="${href}"${
                            isFileLink ? ` download` : ''
                        }>${result}</a>`;
                    } else if (type === 'textStyle') {
                        const styleAttrs = mark?.attrs || {};

                        const { color } = styleAttrs;

                        if (typeof color === 'string' && color)
                            result = `<span style="color: var(--${color})">${result}</span>`;
                    } else if (type === 'bold') {
                        result = `<strong>${result}</strong>`;
                    } else if (type === 'italic') {
                        result = `<em>${result}</em>`;
                    } else if (type === 'highlight') {
                        result = `<span style="background-color: var(--highlight)">${result}</span>`;
                    }
                });

                return result;
            })
            .join('');

        return text;
    }

    instantiateData(data) {
        if (!this.profile && !this.secondaryProfile) return data;

        //Merge text nodes if needed
        // const content = data['content'] || [];

        return this.instantiateContent(data);

        // let str = JSON.stringify(data);

        // return JSON.parse(this.instantiateText(str));
    }

    /**
     * Retrieves the value or label of a variable associated with a given key.
     *
     * @param {string} key - The key to retrieve the value or label of a variable.
     *                       If the key starts with '@', it indicates that the label should be returned.
     *                       If the key starts with '$', it indicates that the key is of "root" type.
     * @returns {string} - The value or label associated with the key, or an empty string if not found.
     */
    getVariable(key, profile) {
        // Check if the key starts with '@', indicating that the label should be returned
        const isLabel = key.startsWith('@');

        // Remove the '@' modifier from the key to get the actual variable name
        let varName = isLabel ? key.slice(1) || '' : key;

        // Check if the variable name starts with '$', indicating that it is of "root" type
        const isRoot = varName.startsWith('$'); // $ is global
        varName = isRoot ? varName.slice(1) || '' : varName;

        let profileEntity = isRoot ? this.profile : this.secondaryProfile; // this.profiles

        const fromOtherSection = varName.startsWith('/');
        if (fromOtherSection) {
            varName = varName.slice(1);

            let parsedVar = varName.replace(/\./g, '/');

            if (isLabel) {
                return this.profile.getMetaInfo(parsedVar) || parsedVar;
            } else {
                if (parsedVar.includes('/')) {
                    let path = parsedVar.split('/');

                    if (path.length > 2) {
                        let last = path.pop();

                        let prefix = path.join('/');
                        let data = profileEntity.getValue(prefix);

                        if (!Profile.isPlainObject(data) && !Array.isArray(data)) return null;

                        return Array.isArray(data) ? data.map((item) => item[last]) : data[last];
                    } else return profileEntity.getValue(parsedVar);
                } else {
                    return profileEntity.getValue(parsedVar);
                }
            }
        } else {
            // If not given, determine the profile based on the "root" type
            if (!profile) {
                profile = profileEntity;
            }

            let parsedVar = varName.replace(/\./g, '/');

            // Build the pending variable using the variable name and type
            const pendingVar = this.buildPendingVariable(parsedVar, isRoot);

            // If the profile is an object or null, we can finish early
            if (!(profile instanceof Profile)) {
                if (isLabel) {
                    let tgtProfile = isRoot ? this.profile : this.secondaryProfile;

                    return tgtProfile?.getMetaInfo(pendingVar) || pendingVar;
                } else {
                    if (parsedVar.includes('/')) {
                        let data = profile;
                        let path = parsedVar.split('/');

                        for (let name of path) {
                            if (!Profile.isPlainObject(data) && !Array.isArray(data)) return null;

                            data = Array.isArray(data)
                                ? data.map((item) => item[name])
                                : data[name];
                        }

                        return data;
                    } else {
                        return profile[varName];
                    }
                }
            }

            // Return the label if '@' modifier is present, otherwise return the value
            return isLabel
                ? profile.getMetaInfo(pendingVar) || pendingVar
                : profile.getValue(pendingVar);
        }
    }

    getSectionItems(text) {
        const isMultipleProfiles = text.startsWith('*');

        text = isMultipleProfiles ? text.slice(1) : text;

        const vars = (key) => {
            if (isMultipleProfiles) {
                return this.profiles
                    .map((profile) => {
                        return this.getVariable(key, profile);
                    })
                    .flat();
            } else {
                return this.getVariable(key);
            }
        };

        // const vars = (key) => this.getVariable(key);

        return this.processor.evaluateText(text, vars);
    }

    // instantiateText(text, givenProfile = null) {
    //     const { global, manual } = this.format;

    //     const { report = false } = this.options;

    //     if (!global && !manual && !report) return text;

    //     const vars = (key) => this.getVariable(key, givenProfile);
    //     return this.processor.render(text, vars);

    //     // const regex =
    //     //     global && manual
    //     //         ? /\$\{(@?\w+[_\w@\.\/]*)\}|\{\{(@?\w+[_\w@\.\/]*)\}\}/g
    //     //         : manual
    //     //         ? /\{\{(@?\w+[_\w@\.\/]*)\}\}/g
    //     //         : /\$\{(@?\w+[_\w@\.\/]*)\}/g;

    //     // let matches = [];

    //     // let match;

    //     // while ((match = regex.exec(text)) !== null) {
    //     //     // matches.push(match[1] || match[2]);
    //     //     let matched = match?.[1] || match?.[2];
    //     //     let isRoot = global ? (match?.[1] ? 1 : 0) : 0;

    //     //     matches.push([matched, isRoot]);
    //     // }

    //     // matches = Array.from(new Set(matches));
    //     // // console.log(matches);
    //     // let result = text;

    //     // let tgtProfile;

    //     // matches.forEach((matched) => {
    //     //     let [pending, isRoot] = matched;

    //     //     tgtProfile = givenProfile || (isRoot ? this.profile : this.secondaryProfile);

    //     //     let pendingVar = this.buildPendingVariable(pending, isRoot);

    //     //     const value = tgtProfile ? tgtProfile.getValue(pendingVar) : '';
    //     //     // console.log(matched, value);

    //     //     const pendingReg = isRoot
    //     //         ? new RegExp(`\\$\\{${pending}\\}`, 'g')
    //     //         : new RegExp(`\\{\\{${pending}\\}\\}`, 'g');

    //     //     if (typeof value === 'string') {
    //     //         result = result.replace(pendingReg, Article.stripTags(value).replace(/"/g, '\\"'));
    //     //     }
    //     // });

    //     // return result;
    // }

    buildPendingVariable(pending, isRoot) {
        if (isRoot) return pending.slice(1) || '';

        if (pending.includes('/') || !this.section) return pending;

        if (pending === '?') pending = this.field || '';

        return `${this.section}${pending ? `/${pending}` : ''}`;
    }

    static getNextNoneEmptyIndex(data, i) {
        let nextIndex = i + 1;

        let next = data[nextIndex];
        let nextType = next?.type;

        let nextContent = next?.content || [];
        // Skip empty paragraphs
        while (nextType === 'paragraph' && !nextContent.length && nextIndex <= data.length - 1) {
            nextIndex++;
            next = data[nextIndex];
            nextType = next?.type;
            nextContent = next?.content || [];
        }

        return nextIndex;
    }

    parseHeader(data, i) {
        let result = {};
        let item = data[i];

        let itemAttrs = item?.attrs;
        let content = item?.content || [];

        let level = itemAttrs?.level;

        let alignment = itemAttrs?.textAlign;

        const headerContent = this.parseHeading(content);
        let key = level === 1 ? 'title' : level === 2 ? 'subtitle' : 'subtitle2';

        result[key] = headerContent;

        result['alignment'] = alignment;

        let nextIndex = Article.getNextNoneEmptyIndex(data, i);

        let next = data?.[nextIndex] || {};
        let nextType = next?.type;
        let nextAttrs = next?.attrs;
        let nextLevel = nextAttrs?.level;
        let nextContent = next?.content || [];

        while (nextType === 'heading' && nextLevel > level && nextIndex <= data.length) {
            let key = nextLevel === 1 ? 'title' : nextLevel === 2 ? 'subtitle' : 'subtitle2';

            let parsedHead = this.parseHeading(nextContent);
            if (!result?.[key]) result[key] = parsedHead;
            else {
                const existHeadings = Array.isArray(result[key]) ? result[key] : [result[key]];
                result[key] = [...existHeadings, parsedHead];
            }

            nextIndex = Article.getNextNoneEmptyIndex(data, nextIndex);

            next = data?.[nextIndex] || {};
            nextType = next?.type;
            nextAttrs = next?.attrs;
            nextLevel = nextAttrs?.level;
            nextContent = next?.content || [];
        }

        return { header: result, nextIndex };
    }

    static hasOnlyLink(item, body) {
        let content = item?.content || [];

        let icons = [];
        //filter out icons
        content = content.filter((c) => {
            if (c.type === 'UniwebIcon') {
                icons.push(c);
                return false;
            } else if (c.type === 'text') {
                return (c.text || '').trim() !== '';
            }

            return true;
        });

        if (content.length === 1) {
            let contentItem = content?.[0];
            let marks = contentItem?.marks || [];

            for (let l = 0; l < marks.length; l++) {
                let mark = marks[l];

                const markType = mark?.type;

                if (markType === 'link') {
                    icons.forEach((icon) => {
                        if (body && body.icons)
                            body.icons.push(Article.parseUniwebIcon(icon.attrs));
                    });

                    return {
                        href: mark?.attrs?.href,
                        label: contentItem?.text || '',
                    };
                }
            }
        }

        return false;
    }

    // method to check if given item has multiple content parts and each of them has the same link attrs with different inline style (plain, em, strong, u)
    // if so, it will return the link attrs and all the content parts whose link mark has been removed
    // warning: This method will not work if the any of the content parts are not link marks
    static hasOnlyStyledLink(item, body) {
        let content = item?.content || [];

        if (!content.length) return false;

        // const icons = [];
        //filter out icons
        content = content.filter((c) => {
            if (c.type === 'UniwebIcon') {
                // icons.push(c);
                return false;
            }
            return true;
        });

        // check if all content items have the same link mark
        let firstLinkMark = content[0]?.marks?.find((mark) => mark.type === 'link' && mark.attrs);
        if (!firstLinkMark) return false;
        if (
            !content.every(
                (c) =>
                    c?.marks?.some(
                        (mark) => mark.type === 'link' && isEqual(mark.attrs, firstLinkMark?.attrs)
                    ) || false
            )
        )
            return false;

        const { href, target } = firstLinkMark.attrs;

        const cleanedContent = content.map((c) => {
            // remove link marks from content items
            const cleanedMarks = c.marks?.filter((mark) => mark.type !== 'link') || [];
            return {
                ...c,
                marks: cleanedMarks,
            };
        });

        return {
            href,
            target,
            content: cleanedContent,
        };
    }

    parseGenericData(data) {
        let body = {
            imgs: [],
            videos: [],
            lists: [],
            links: [],
            headings: [],
            paragraphs: [],
            properties: [],
            propertyBlocks: [],
            icons: [],
            cards: [],
            documents: [],
            buttons: [],
            form: [],
            forms: [],
            quotes: [],
        };

        data.forEach((item) => {
            let itemType = item?.type;
            let itemAttrs = item?.attrs;
            let content = item?.content || [];

            switch (itemType) {
                case 'heading':
                case 'paragraph':
                    let linkVal = Article.hasOnlyLink(item, body);
                    let styledLinkVal = Article.hasOnlyStyledLink(item, body);

                    if (linkVal) {
                        body.links.push(linkVal);
                    } else if (styledLinkVal) {
                        let parsedContent = this.parseHeading(styledLinkVal.content, body);
                        const linkHtml = `<a target="${styledLinkVal.target}" href="${styledLinkVal.href}">${parsedContent}</a>`;
                        body[`${itemType}s`].push(linkHtml);
                    } else {
                        let parsedContent = this.parseHeading(content, body);

                        if (parsedContent) body[`${itemType}s`].push(parsedContent);
                    }
                    break;
                case 'ImageBlock':
                    body.imgs.push(this.parseImgBlock(itemAttrs));
                    break;
                case 'Video':
                    body.videos.push(Article.parseVideoBlock(itemAttrs));
                    break;
                case 'bulletList':
                    const listItems = content
                        .map((c) => (c.type === 'listItem' ? c.content : null))
                        .filter(Boolean);

                    body.lists.push(
                        listItems.map((listItem) => {
                            return this.parseGenericData(listItem);
                        })
                    );
                    break;
                case 'codeBlock':
                    let property = Article.parseCodeBlock(content);
                    body.properties = property;
                    body.propertyBlocks.push(property);
                    break;
                case 'FormBlock':
                    let form = Article.parseFormBlock(itemAttrs);
                    body.forms.push(form);
                    body.form = form;
                    break;
                case 'UniwebIcon':
                    body.icons.push(Article.parseUniwebIcon(itemAttrs));
                    break;
                case 'Icon':
                    body.icons.push(Article.parseIconBlock(itemAttrs));
                    break;
                case 'card-group':
                    const cards = content
                        .map((c) => (c.type === 'card' && !c.attrs.hidden ? c : null))
                        .filter(Boolean);

                    body.cards.push(
                        ...cards.map((card) => {
                            return Article.parseCardBlock(card.attrs);
                        })
                    );
                    break;
                case 'document-group':
                    const documents = content
                        .map((c) => (c.type === 'document' ? c : null))
                        .filter(Boolean);

                    body.documents.push(
                        ...documents.map((doc) => {
                            return Article.parseDocumentBlock(doc.attrs);
                        })
                    );
                    break;
                case 'button':
                    body.buttons.push({
                        attrs: itemAttrs,
                        content: this.parseHeading(content),
                    });
                    break;
                case 'blockquote':
                    let parsedContent = this.parseGenericData(content, body);
                    if (parsedContent) body[`quotes`].push(parsedContent);
                    break;
            }
        });

        return body;
    }

    parseItem(data) {
        let banner = null,
            header = null,
            body = null;

        let headerStartIndex = 0;
        let bannerStartIndex = 0;
        let i = 0;

        while (i < data.length) {
            let item = data[i];

            let itemType = item?.type;
            let itemAttrs = item?.attrs;
            let content = item?.content || [];

            // Ignore empty paragraph
            if (itemType === 'paragraph' && !content.length) {
                bannerStartIndex++;
                headerStartIndex++;
                i++;
                continue;
            }

            // Found the banner
            if (i === bannerStartIndex && itemType === 'ImageBlock' && !banner) {
                banner = this.parseImgBlock(itemAttrs);

                // If we found the banner, the header settings may start from second element
                headerStartIndex++;
                i++;
                continue;
            }

            // Try to find the heading settings. label, title, subtitle, description
            // Possible combinations:
            // H1, H1 [H2] [H3], H2 H1 [H2] [H3], [H2] [H3]
            if (i === headerStartIndex && itemType === 'heading' && !header) {
                let level = itemAttrs?.level;
                let tgtIndex = i;

                header = {};

                // Handle the special case which starts with H2 and follow with a H1
                if (level === 2) {
                    let nextIndex = Article.getNextNoneEmptyIndex(data, i);

                    if (nextIndex > data.length) {
                        i = nextIndex;
                        break;
                    }

                    let next = data[nextIndex];
                    let nextType = next?.type;
                    let nextAttrs = next?.attrs;

                    if (nextType === 'heading' && nextAttrs?.level === 1) {
                        header.pretitle = this.parseHeading(content);

                        tgtIndex = nextIndex;
                    }
                }

                let { header: parsedHeader, nextIndex: parsedIndex } = this.parseHeader(
                    data,
                    tgtIndex
                );

                header = { ...header, ...parsedHeader };

                i = parsedIndex;
                break;
            }

            break;
        }

        if (i < data.length) body = this.parseGenericData(data.slice(i));

        if (header) header.description = header?.subtitle2 || body?.paragraphs?.[0] || '';

        return { header, banner, body };
    }

    /**
     * Parse the contents of an article.
     *
     * @type {Object}
     * @return {Object} Of the form {main, items}, where `main` is header item
     * if there is one, and items are the rest of the items.
     */
    parse(elements) {
        if (!elements.length) {
            return {};
        } else if (elements.length === 1) {
            return { main: this.parseItem(elements[0]) };
        } else {
            let data = [];

            for (const item of elements) {
                let parsedItem = null;
                if (Array.isArray(item)) {
                    parsedItem = this.parseItem(item);
                } else {
                    const itemData = item?.data;
                    const itemProfile = item?.profile;

                    parsedItem = {
                        ...this.parseItem(itemData),
                        profile: itemProfile,
                    };
                }

                data.push(parsedItem);
            }

            // Get all items after the first one
            let items = data.slice(1);

            return { main: data[0], items: items };

            // If the first item has a title (H1) and all other items
            // don't have one, then the first item is a special case
            // if (data[0]?.header?.title && !items.filter((item) => item?.header?.title).length) {
            //     return { main: data[0], items: items };
            // } else {
            //     return { items: data };
            // }
        }
    }

    /**
     * Strip html string uses regular expressions;
     * Remove all HTML tags from an HTML string and returns a plain string
     * @param {string} htmlString
     * @returns {string} plainString
     */
    static stripTags(htmlString) {
        if (!htmlString || typeof htmlString !== 'string') return '';

        // Remove HTML tags using regular expression
        const plainString = htmlString.replace(/<[^>]*>/g, '');

        // Decode HTML entities
        const decodedString = new DOMParser().parseFromString(plainString, 'text/html').body
            .textContent;

        return decodedString;
    }

    instantiateContent(content, givenProfile = null) {
        const { global, manual } = this.format;

        const { report = false } = this.options;

        if (!global && !manual && !report) return content;

        const vars = (key) => this.getVariable(key, givenProfile);
        let render = (key) => this.processor.render(key, vars);

        // console.log('Instantiating content', givenProfile.id);

        if (Array.isArray(content)) {
            return this.instantiateBlocks([...content], render);
        } else {
            let innerContent = [...(content?.['content'] || [])];

            return {
                ...content,
                content: this.instantiateBlocks(innerContent, render),
            };
        }
    }

    instantiateBlocks(blocks, render) {
        return blocks.map((block) => {
            return this.instantiateComponent(block, render);
        });
    }

    instantiateComponent(block, render) {
        const { type, content } = block;

        switch (type) {
            case 'text': {
                const { text } = block;

                return {
                    ...block,
                    text: render(text),
                };
            }
            default:
                if (content && Array.isArray(content))
                    return {
                        ...block,
                        content: this.instantiateBlocks(content, render),
                    };
                else {
                    return block;
                }
        }
    }
}
