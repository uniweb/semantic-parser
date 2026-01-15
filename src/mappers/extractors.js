/**
 * Pre-built extractors for common component patterns
 */

import { first, joinParagraphs } from "./helpers.js";

/**
 * Extract hero component data
 * Common pattern: Large header with title, subtitle, image, and CTA
 *
 * @param {Object} parsed - Parsed content from parseContent()
 * @returns {Object} Hero component data
 */
function hero(parsed) {
    const main = parsed.groups?.main;

    return {
        title: main?.header?.title || null,
        subtitle: main?.header?.subtitle || null,
        kicker: main?.header?.pretitle || null,
        description: main?.body?.paragraphs || [],
        image: first(main?.body?.imgs)?.url || null,
        imageAlt: first(main?.body?.imgs)?.alt || null,
        banner: main?.banner?.url || null,
        cta: first(main?.body?.links) || null,
        button: first(main?.body?.buttons) || null,
    };
}

/**
 * Extract card component data
 * Common pattern: Title, description, image, and link
 *
 * @param {Object} parsed - Parsed content from parseContent()
 * @param {Object} options - Extraction options
 * @param {boolean} options.useItems - Extract from items instead of main
 * @param {number} options.itemIndex - Specific item index to extract from
 * @returns {Object|Array} Card data or array of cards if useItems=true
 */
function card(parsed, options = {}) {
    const { useItems = false, itemIndex } = options;

    const extractCard = (group) => {
        if (!group) return null;

        return {
            title: group.header?.title || null,
            subtitle: group.header?.subtitle || null,
            description: group.body?.paragraphs || [],
            image: first(group.body?.imgs)?.url || null,
            imageAlt: first(group.body?.imgs)?.alt || null,
            icon: first(group.body?.icons) || null,
            link: first(group.body?.links) || null,
            button: first(group.body?.buttons) || null,
        };
    };

    if (useItems) {
        const items = parsed.groups?.items || [];
        if (itemIndex !== undefined) {
            return extractCard(items[itemIndex]);
        }
        return items.map(extractCard).filter(Boolean);
    }

    return extractCard(parsed.groups?.main);
}

/**
 * Extract article/blog content
 * Common pattern: Title, author info, content blocks, images
 *
 * @param {Object} parsed - Parsed content from parseContent()
 * @returns {Object} Article data
 */
function article(parsed) {
    const main = parsed.groups?.main;

    return {
        title: main?.header?.title || null,
        subtitle: main?.header?.subtitle || null,
        kicker: main?.header?.pretitle || null,
        author: main?.metadata?.author || null,
        date: main?.metadata?.date || null,
        banner: main?.banner?.url || null,
        content: main?.body?.paragraphs || [],
        images: main?.body?.imgs || [],
        videos: main?.body?.videos || [],
        links: main?.body?.links || [],
    };
}

/**
 * Extract statistics/metrics data
 * Common pattern: Numeric value with label
 *
 * @param {Object} parsed - Parsed content from parseContent()
 * @returns {Array} Array of stat objects
 */
function stats(parsed) {
    const items = parsed.groups?.items || [];

    return items
        .map((item) => ({
            value: item.header?.title || null,
            label:
                item.header?.subtitle || first(item.body?.paragraphs) || null,
            description: item.body?.paragraphs || [],
        }))
        .filter((stat) => stat.value);
}

/**
 * Extract navigation menu structure
 * Common pattern: Hierarchical menu with labels, links, and optional children
 *
 * @param {Object} parsed - Parsed content from parseContent()
 * @returns {Array} Navigation items
 */
function navigation(parsed) {
    const items = parsed.groups?.items || [];

    return items
        .map((item) => {
            const navItem = {
                label: item.header?.title || null,
                href: first(item.body?.links)?.href || null,
            };

            // Extract children from nested lists
            const firstList = first(item.body?.lists);
            if (firstList && firstList.length > 0) {
                navItem.children = firstList
                    .map((listItem) => ({
                        label: joinParagraphs(listItem.paragraphs) || null,
                        href: first(listItem.links)?.href || null,
                        icon: first(listItem.icons) || null,
                    }))
                    .filter((child) => child.label);
            }

            return navItem;
        })
        .filter((item) => item.label);
}

/**
 * Extract feature list
 * Common pattern: Icon/image, title, description
 *
 * @param {Object} parsed - Parsed content from parseContent()
 * @returns {Array} Feature items
 */
function features(parsed) {
    const items = parsed.groups?.items || [];

    return items
        .map((item) => ({
            title: item.header?.title || null,
            subtitle: item.header?.subtitle || null,
            description: item.body?.paragraphs || [],
            icon: first(item.body?.icons) || null,
            image: first(item.body?.imgs)?.url || null,
            link: first(item.body?.links) || null,
        }))
        .filter((feature) => feature.title);
}

/**
 * Extract testimonial data
 * Common pattern: Quote, author name, role, image
 *
 * @param {Object} parsed - Parsed content from parseContent()
 * @param {Object} options - Extraction options
 * @param {boolean} options.useItems - Extract from items instead of main
 * @returns {Object|Array} Testimonial data
 */
function testimonial(parsed, options = {}) {
    const { useItems = false } = options;

    const extractTestimonial = (group) => {
        if (!group) return null;

        return {
            quote: group.body?.paragraphs || [],
            author: group.header?.title || null,
            role: group.header?.subtitle || null,
            company: group.header?.pretitle || null,
            image: first(group.body?.imgs)?.url || null,
            imageAlt: first(group.body?.imgs)?.alt || null,
        };
    };

    if (useItems) {
        const items = parsed.groups?.items || [];
        return items.map(extractTestimonial).filter(Boolean);
    }

    return extractTestimonial(parsed.groups?.main);
}

/**
 * Extract FAQ (question and answer pairs)
 * Common pattern: Question as title, answer as content
 *
 * @param {Object} parsed - Parsed content from parseContent()
 * @returns {Array} FAQ items
 */
function faq(parsed) {
    const items = parsed.groups?.items || [];

    return items
        .map((item) => ({
            question: item.header?.title || null,
            answer: item.body?.paragraphs || [],
            links: item.body?.links || [],
        }))
        .filter((item) => item.question);
}

/**
 * Extract pricing tier data
 * Common pattern: Plan name, price, features list, CTA
 *
 * @param {Object} parsed - Parsed content from parseContent()
 * @returns {Array} Pricing tiers
 */
function pricing(parsed) {
    const items = parsed.groups?.items || [];

    return items
        .map((item) => {
            const firstList = first(item.body?.lists);

            return {
                name: item.header?.title || null,
                price: item.header?.subtitle || null,
                description: first(item.body?.paragraphs) || null,
                features: firstList
                    ? firstList
                          .map((listItem) =>
                              joinParagraphs(listItem.paragraphs)
                          )
                          .filter(Boolean)
                    : [],
                cta:
                    first(item.body?.links) ||
                    first(item.body?.buttons) ||
                    null,
                highlighted:
                    item.header?.pretitle?.toLowerCase().includes("popular") ||
                    false,
            };
        })
        .filter((tier) => tier.name);
}

/**
 * Extract team member data
 * Common pattern: Name, role, bio, image, social links
 *
 * @param {Object} parsed - Parsed content from parseContent()
 * @returns {Array} Team members
 */
function team(parsed) {
    const items = parsed.groups?.items || [];

    return items
        .map((item) => ({
            name: item.header?.title || null,
            role: item.header?.subtitle || null,
            department: item.header?.pretitle || null,
            bio: item.body?.paragraphs || [],
            image: first(item.body?.imgs)?.url || null,
            imageAlt: first(item.body?.imgs)?.alt || null,
            links: item.body?.links || [],
        }))
        .filter((member) => member.name);
}

/**
 * Extract gallery images
 * Common pattern: Collection of images with captions
 *
 * @param {Object} parsed - Parsed content from parseContent()
 * @param {Object} options - Extraction options
 * @param {string} options.source - Source to extract from: 'main', 'items', 'all'
 * @returns {Array} Gallery images
 */
function gallery(parsed, options = {}) {
    const { source = "all" } = options;
    const images = [];

    if (source === "main" || source === "all") {
        const mainImages = parsed.groups?.main?.body?.imgs || [];
        images.push(...mainImages);
    }

    if (source === "items" || source === "all") {
        const items = parsed.groups?.items || [];
        items.forEach((item) => {
            const itemImages = item.body?.imgs || [];
            images.push(...itemImages);
        });
    }

    return images.map((img) => ({
        url: img.url,
        alt: img.alt || null,
        caption: img.caption || null,
    }));
}

/**
 * Extract content in legacy Article class format
 * Used for backward compatibility with existing components
 *
 * This extractor transforms the new parser output into the exact format
 * used by the legacy Article class, enabling drop-in replacement without
 * breaking existing components.
 *
 * @param {Object} parsed - Parsed content from parseContent()
 * @returns {Object} Legacy format { main, items }
 *
 * @example
 * const { parseContent, mappers } = require('@uniwebcms/semantic-parser');
 * const parsed = parseContent(doc, { pretitleLevel: 2, parseCodeAsJson: true });
 * const legacy = mappers.extractors.legacy(parsed);
 * // Returns: { main: {...}, items: [...] }
 */
function legacy(parsed) {
    const groups = parsed.groups || {};

    const transformGroup = (group) => {
        if (!group) return null;

        let imgs = group.body?.imgs || [];
        let banner = imgs.filter((item) => {
            return (item.role = "banner");
        })?.[0];

        if (!banner) banner = imgs[0];

        return {
            header: {
                title: group.header?.title || "",
                subtitle: group.header?.subtitle || "",
                subtitle2: group.header?.subtitle2 || "",
                pretitle: group.header?.pretitle || "",
                // Auto-fill description (legacy behavior)
                description:
                    group.header?.subtitle2 ||
                    first(group.body?.paragraphs) ||
                    "",
                alignment: group.header?.alignment || "",
            },
            banner,
            body: {
                paragraphs: group.body?.paragraphs || [],
                headings: group.body?.headings || [],
                imgs,
                videos: group.body?.videos || [],
                lists: group.body?.lists || [],
                links: group.body?.links || [],
                icons: group.body?.icons || [],
                buttons: group.body?.buttons || [],
                cards: group.body?.cards || [],
                documents: group.body?.documents || [],
                forms: group.body?.forms || [],
                form: first(group.body?.forms) || null,
                quotes: group.body?.quotes || [],
                properties: group.body?.properties || {},
                propertyBlocks: group.body?.propertyBlocks || [],
            },
        };
    };

    return {
        main: transformGroup(groups.main),
        items: (groups.items || []).map(transformGroup),
    };
}

export {
    hero,
    card,
    article,
    stats,
    navigation,
    features,
    testimonial,
    faq,
    pricing,
    team,
    gallery,
    legacy,
};
