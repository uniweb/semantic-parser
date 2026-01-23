/**
 * Pre-built extractors for common component patterns
 *
 * All extractors work with the flat content structure:
 * - Root level: title, pretitle, subtitle, paragraphs, links, imgs, items, etc.
 * - Items array: each item has flat structure (title, paragraphs, etc.)
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
    return {
        title: parsed?.title || null,
        subtitle: parsed?.subtitle || null,
        kicker: parsed?.pretitle || null,
        description: parsed?.paragraphs || [],
        image: first(parsed?.imgs)?.url || null,
        imageAlt: first(parsed?.imgs)?.alt || null,
        banner: null, // Banner detection would need to be added separately
        cta: first(parsed?.links) || null,
        button: first(parsed?.buttons) || null,
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

    const extractCard = (content) => {
        if (!content) return null;

        return {
            title: content.title || null,
            subtitle: content.subtitle || null,
            description: content.paragraphs || [],
            image: first(content.imgs)?.url || null,
            imageAlt: first(content.imgs)?.alt || null,
            icon: first(content.icons) || null,
            link: first(content.links) || null,
            button: first(content.buttons) || null,
        };
    };

    if (useItems) {
        const items = parsed?.items || [];
        if (itemIndex !== undefined) {
            return extractCard(items[itemIndex]);
        }
        return items.map(extractCard).filter(Boolean);
    }

    return extractCard(parsed);
}

/**
 * Extract article/blog content
 * Common pattern: Title, author info, content blocks, images
 *
 * @param {Object} parsed - Parsed content from parseContent()
 * @returns {Object} Article data
 */
function article(parsed) {
    return {
        title: parsed?.title || null,
        subtitle: parsed?.subtitle || null,
        kicker: parsed?.pretitle || null,
        author: null, // Would need metadata support
        date: null,   // Would need metadata support
        banner: null, // Banner detection would need to be added separately
        content: parsed?.paragraphs || [],
        images: parsed?.imgs || [],
        videos: parsed?.videos || [],
        links: parsed?.links || [],
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
    const items = parsed?.items || [];

    return items
        .map((item) => ({
            value: item.title || null,
            label: item.subtitle || first(item.paragraphs) || null,
            description: item.paragraphs || [],
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
    const items = parsed?.items || [];

    return items
        .map((item) => {
            const navItem = {
                label: item.title || null,
                href: first(item.links)?.href || null,
            };

            // Extract children from nested lists
            const firstList = first(item.lists);
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
    const items = parsed?.items || [];

    return items
        .map((item) => ({
            title: item.title || null,
            subtitle: item.subtitle || null,
            description: item.paragraphs || [],
            icon: first(item.icons) || null,
            image: first(item.imgs)?.url || null,
            link: first(item.links) || null,
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

    const extractTestimonial = (content) => {
        if (!content) return null;

        return {
            quote: content.paragraphs || [],
            author: content.title || null,
            role: content.subtitle || null,
            company: content.pretitle || null,
            image: first(content.imgs)?.url || null,
            imageAlt: first(content.imgs)?.alt || null,
        };
    };

    if (useItems) {
        const items = parsed?.items || [];
        return items.map(extractTestimonial).filter(Boolean);
    }

    return extractTestimonial(parsed);
}

/**
 * Extract FAQ (question and answer pairs)
 * Common pattern: Question as title, answer as content
 *
 * @param {Object} parsed - Parsed content from parseContent()
 * @returns {Array} FAQ items
 */
function faq(parsed) {
    const items = parsed?.items || [];

    return items
        .map((item) => ({
            question: item.title || null,
            answer: item.paragraphs || [],
            links: item.links || [],
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
    const items = parsed?.items || [];

    return items
        .map((item) => {
            const firstList = first(item.lists);

            return {
                name: item.title || null,
                price: item.subtitle || null,
                description: first(item.paragraphs) || null,
                features: firstList
                    ? firstList
                          .map((listItem) =>
                              joinParagraphs(listItem.paragraphs)
                          )
                          .filter(Boolean)
                    : [],
                cta: first(item.links) || first(item.buttons) || null,
                highlighted:
                    item.pretitle?.toLowerCase().includes("popular") || false,
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
    const items = parsed?.items || [];

    return items
        .map((item) => ({
            name: item.title || null,
            role: item.subtitle || null,
            department: item.pretitle || null,
            bio: item.paragraphs || [],
            image: first(item.imgs)?.url || null,
            imageAlt: first(item.imgs)?.alt || null,
            links: item.links || [],
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
        const mainImages = parsed?.imgs || [];
        images.push(...mainImages);
    }

    if (source === "items" || source === "all") {
        const items = parsed?.items || [];
        items.forEach((item) => {
            const itemImages = item.imgs || [];
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
 * This extractor transforms the new flat parser output into the nested format
 * used by the legacy Article class, enabling drop-in replacement without
 * breaking existing components.
 *
 * @param {Object} parsed - Parsed content from parseContent() (flat structure)
 * @returns {Object} Legacy format { main, items } with nested header/body structure
 *
 * @example
 * const { parseContent, mappers } = require('@uniweb/semantic-parser');
 * const parsed = parseContent(doc);
 * const legacy = mappers.extractors.legacy(parsed);
 * // Returns: { main: { header: {...}, body: {...} }, items: [...] }
 */
function legacy(parsed) {
    const transformToNested = (content) => {
        if (!content) return null;

        let imgs = content.imgs || [];
        let banner = imgs.filter((item) => {
            return (item.role = "banner");
        })?.[0];

        if (!banner) banner = imgs[0];

        return {
            header: {
                title: content.title || "",
                subtitle: content.subtitle || "",
                subtitle2: content.subtitle2 || "",
                pretitle: content.pretitle || "",
                // Auto-fill description (legacy behavior)
                description:
                    content.subtitle2 ||
                    first(content.paragraphs) ||
                    "",
                alignment: content.alignment || "",
            },
            banner,
            body: {
                paragraphs: content.paragraphs || [],
                headings: content.headings || [],
                imgs,
                videos: content.videos || [],
                lists: content.lists || [],
                links: content.links || [],
                icons: content.icons || [],
                buttons: content.buttons || [],
                cards: content.cards || [],
                documents: content.documents || [],
                forms: content.forms || [],
                form: first(content.forms) || null,
                quotes: content.quotes || [],
                properties: content.properties || {},
                propertyBlocks: content.propertyBlocks || [],
            },
        };
    };

    return {
        main: transformToNested(parsed),
        items: (parsed?.items || []).map(transformToNested),
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
