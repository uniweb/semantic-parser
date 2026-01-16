/**
 * Article Class - New Implementation using @uniweb/semantic-parser
 *
 * This is a drop-in replacement for the legacy Article class that uses
 * the semantic-parser library internally while maintaining the same API.
 *
 * Key changes from legacy:
 * - Uses semantic-parser for content parsing (replaces 800+ lines of parsing code)
 * - Keeps template/variable system as-is (battle-tested)
 * - Maintains exact same output format via legacy extractor
 * - ~80% code reduction while preserving all functionality
 */

import { parseContent } from "../src/index.js";
import { extractors } from "../src/mappers/index.js";
import Profile from "./profile.js";

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
                            return "undefined";
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

                    // this.elements = Article.splitItems(
                    //     parsedData?.["content"] || []
                    // );

                    // this.parsed = this.parse(this.elements);
                    this.parsed = this.parse(parsedData);
                } else {
                    const parsedData = this.instantiateData(data);
                    this.content = parsedData;

                    // this.elements = Article.splitItems(
                    //     parsedData?.["content"] || []
                    // );

                    // this.parsed = this.parse(this.elements);
                    this.parsed = this.parse(parsedData);
                }
            }
        } else {
            //If there is report settings, we need to somehow manipulate the data
            // with given report settings
            const parsedData = global ? this.instantiateData(data) : data;
            this.content = parsedData;

            // this.elements = Article.splitItems(parsedData?.["content"] || []);

            this.parsed = this.parse(parsedData || []);
        }
    }

    parseWithAutoItems(data) {
        const elements = Article.splitItems(data?.["content"] || []);

        if (elements.length === 2) {
            const [primary, secondary] = elements;

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
                    this.section = "";
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
                type: "doc",
                content: [...parsedPrimary, ...items.flat()],
            };

            // this.elements = [parsedPrimary, ...items];

            // this.parsed = this.parse(this.elements);
            this.parse = this.parse(this.content);

            this.autoItems = true;

            return true;
        }

        return false;
    }

    /**
     * Parse elements using the semantic-parser library
     *
     * This method uses the @uniweb/semantic-parser library internally
     * while maintaining the exact same output format as the legacy implementation.
     */
    parse(doc) {
        // Flatten elements into a single document
        // const doc = {
        //     type: "doc",
        //     content: elements.flat(),
        // };

        // Parse with legacy-compatible options
        const parsed = parseContent(doc, {
            parseCodeAsJson: true, // Properties feature (legacy)
        });

        // Transform to legacy format
        return extractors.legacy(parsed);
    }

    ///////////////////////////////////////////////////////////////////////////
    // STATIC METHODS (kept from legacy for divider splitting)

    static isEmptyItem(ele) {
        for (let i = 0; i < ele.length; i++) {
            let item = ele[i];

            const { type, content = [] } = item;

            if (type !== "paragraph" || content.length) return false;
        }

        return true;
    }

    static splitItems(doc) {
        const elements = [];

        let ele = [];
        doc.forEach((item) => {
            const { type } = item;

            if (type === "DividerBlock") {
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

        if (ele.length) {
            elements.push([...ele]);
        }

        if (!elements.length) return [doc];

        return elements.filter((item, i) => {
            if (!i) return !this.isEmptyItem(item);

            return true;
        });
    }

    ///////////////////////////////////////////////////////////////////////////
    // TEMPLATE SYSTEM METHODS (kept as-is from legacy)

    instantiateData(data) {
        if (!this.profile && !this.secondaryProfile) return data;

        return this.instantiateContent(data);
    }

    instantiateContent(content, givenProfile = null) {
        if (!this.profile && !this.secondaryProfile) return content;

        if (!Array.isArray(content)) content = [content];

        return content.map((item) => this.processNode(item, givenProfile));
    }

    processNode(node, givenProfile = null) {
        if (!node || typeof node !== "object") return node;

        const processed = { ...node };

        if (processed.content) {
            processed.content = Array.isArray(processed.content)
                ? processed.content.map((child) =>
                      this.processNode(child, givenProfile)
                  )
                : this.processNode(processed.content, givenProfile);
        }

        if (processed.type === "text" && processed.text) {
            processed.text = this.processor.render(processed.text, (key) =>
                this.getVariable(key, givenProfile)
            );
        }

        return processed;
    }

    getVariable(key, profile) {
        // Check if the key starts with '@', indicating that the label should be returned
        const isLabel = key.startsWith("@");

        // Remove the '@' modifier from the key to get the actual variable name
        let varName = isLabel ? key.slice(1) || "" : key;

        // Check if the variable name starts with '$', indicating that it is of "root" type
        const isRoot = varName.startsWith("$"); // $ is global
        varName = isRoot ? varName.slice(1) || "" : varName;

        let profileEntity = isRoot ? this.profile : this.secondaryProfile;

        const fromOtherSection = varName.startsWith("/");
        if (fromOtherSection) {
            varName = varName.slice(1);

            let parsedVar = varName.replace(/\./g, "/");

            if (isLabel) {
                return this.profile.getMetaInfo(parsedVar) || parsedVar;
            } else {
                if (parsedVar.includes("/")) {
                    let path = parsedVar.split("/");

                    if (path.length > 2) {
                        let last = path.pop();

                        let prefix = path.join("/");
                        let data = profileEntity.getValue(prefix);

                        if (
                            !Profile.isPlainObject(data) &&
                            !Array.isArray(data)
                        )
                            return null;

                        return Array.isArray(data)
                            ? data.map((item) => item[last])
                            : data[last];
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

            let parsedVar = varName.replace(/\./g, "/");

            // Build the pending variable using the variable name and type
            const pendingVar = this.buildPendingVariable(parsedVar, isRoot);

            // If the profile is an object or null, we can finish early
            if (!(profile instanceof Profile)) {
                if (isLabel) {
                    let tgtProfile = isRoot
                        ? this.profile
                        : this.secondaryProfile;

                    return tgtProfile?.getMetaInfo(pendingVar) || pendingVar;
                } else {
                    if (parsedVar.includes("/")) {
                        let data = profile;
                        let path = parsedVar.split("/");

                        for (let name of path) {
                            if (
                                !Profile.isPlainObject(data) &&
                                !Array.isArray(data)
                            )
                                return null;

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
        const isMultipleProfiles = text.startsWith("*");

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

        return this.processor.evaluateText(text, vars);
    }

    buildPendingVariable(pending, isRoot) {
        if (isRoot) return pending.slice(1) || "";

        if (pending.includes("/") || !this.section) return pending;

        if (pending === "?") pending = this.field || "";

        return `${this.section}${pending ? `/${pending}` : ""}`;
    }
}
