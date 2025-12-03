/**
 * Sync Loader Script
 *
 * This tiny script loads synchronously to:
 * 1. Inject FOUC-hiding styles immediately (before DOM renders)
 * 2. Fetch and display content (critical path)
 * 3. Remove hiding styles once content is visible
 * 4. Inject the ESM bundle for lazy features (auth UI, editing)
 *
 * Customer usage: <script src="streamlined-cms.js" data-app-id="..."></script>
 */

(function () {
    // Find our own script tag to get config (do this first, before any DOM modifications)
    const loaderScript = document.currentScript as HTMLScriptElement;
    if (!loaderScript) return;

    // Parse config from data attributes
    const appId = loaderScript.dataset.appId;
    if (!appId) {
        console.error("[StreamlinedCMS] App ID is required. Add data-app-id to your script tag.");
        return;
    }

    const apiUrl = loaderScript.dataset.apiUrl || __SDK_API_URL__;

    // Inject preconnect hint immediately to start TLS handshake early
    const apiOrigin = new URL(apiUrl).origin;
    const preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = apiOrigin;
    preconnect.crossOrigin = "anonymous";
    document.head.appendChild(preconnect);

    // Inject hiding styles immediately
    const style = document.createElement("style");
    style.id = "streamlined-cms-hiding";
    style.textContent = "[data-scms-text],[data-scms-html],[data-scms-image],[data-scms-link]{visibility:hidden}";
    document.head.appendChild(style);

    // Determine ESM bundle URL (same directory as loader)
    const loaderSrc = loaderScript.src;
    const basePath = loaderSrc.substring(0, loaderSrc.lastIndexOf("/") + 1);
    const esmUrl = basePath + "streamlined-cms.esm.js";

    /**
     * Inject the ESM module for lazy features
     */
    function injectEsmModule(): void {
        const moduleScript = document.createElement("script");
        moduleScript.type = "module";
        moduleScript.src = esmUrl;

        // Copy all data attributes from loader to module script
        const attrs = loaderScript.attributes;
        for (let i = 0; i < attrs.length; i++) {
            const attr = attrs[i];
            if (attr.name.startsWith("data-")) {
                moduleScript.setAttribute(attr.name, attr.value);
            }
        }

        // Insert after the loader script
        loaderScript.after(moduleScript);
    }

    /**
     * Editable element types
     */
    type EditableType = "text" | "html" | "image" | "link";

    /**
     * Element info including optional group and type
     */
    interface EditableElementInfo {
        element: HTMLElement;
        groupId: string | null;
        type: EditableType;
    }

    /**
     * Get group ID for an element by checking data-scms-group on self or ancestors
     */
    function getGroupId(element: HTMLElement): string | null {
        // First check the element itself
        const selfGroup = element.getAttribute("data-scms-group");
        if (selfGroup) return selfGroup;

        // Walk up to find nearest ancestor with data-scms-group
        let parent = element.parentElement;
        while (parent) {
            const parentGroup = parent.getAttribute("data-scms-group");
            if (parentGroup) return parentGroup;
            parent = parent.parentElement;
        }
        return null;
    }

    /**
     * Get editable info from element by checking data-scms-{type} attributes
     */
    function getEditableInfo(element: HTMLElement): { id: string; type: EditableType } | null {
        const types: EditableType[] = ["text", "html", "image", "link"];
        for (const type of types) {
            const id = element.getAttribute(`data-scms-${type}`);
            if (id) return { id, type };
        }
        return null;
    }

    /**
     * Scan DOM for editable elements, including group info
     */
    function scanEditableElements(): Map<string, EditableElementInfo> {
        const elements = new Map<string, EditableElementInfo>();
        const selector = "[data-scms-text], [data-scms-html], [data-scms-image], [data-scms-link]";
        document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
            const info = getEditableInfo(element);
            if (info) {
                const groupId = getGroupId(element);
                // Use composite key for grouped elements: groupId:elementId
                const key = groupId ? `${groupId}:${info.id}` : info.id;
                elements.set(key, { element, groupId, type: info.type });
            }
        });
        return elements;
    }

    /**
     * Update a single element with content
     * Handles typed JSON format: { type: "text"|"html"|"image"|"link", ... }
     */
    function updateElement(
        elements: Map<string, EditableElementInfo>,
        key: string,
        content: string
    ): void {
        const info = elements.get(key);
        if (!info) return;

        const element = info.element;

        // Try to parse as typed JSON content
        try {
            const data = JSON.parse(content) as { type?: string };

            if (data.type === "text") {
                element.textContent = (data as { type: "text"; value: string }).value;
                return;
            } else if (data.type === "html") {
                element.innerHTML = (data as { type: "html"; value: string }).value;
                return;
            } else if (data.type === "image" && element instanceof HTMLImageElement) {
                const src = (data as { type: "image"; src: string }).src;
                // Create new image and swap immediately to avoid placeholder flash
                const newImg = document.createElement("img");
                for (let i = 0; i < element.attributes.length; i++) {
                    const attr = element.attributes[i];
                    newImg.setAttribute(attr.name, attr.value);
                }
                newImg.src = src;
                element.replaceWith(newImg);
                elements.set(key, { element: newImg, groupId: info.groupId, type: info.type });
                return;
            } else if (data.type === "link" && element instanceof HTMLAnchorElement) {
                const linkData = data as { type: "link"; href: string; target: string; text: string };
                element.href = linkData.href;
                element.target = linkData.target;
                element.textContent = linkData.text;
                return;
            } else if (data.type) {
                // Unknown type with type field - don't process
                return;
            }
            // No type field in JSON - use element's declared type
            if (info.type === "link" && element instanceof HTMLAnchorElement) {
                const linkData = data as { href?: string; target?: string; text?: string };
                if (linkData.href !== undefined) {
                    element.href = linkData.href;
                    element.target = linkData.target || "";
                    element.textContent = linkData.text || "";
                    return;
                }
            } else if (info.type === "image" && element instanceof HTMLImageElement) {
                const imageData = data as { src?: string };
                if (imageData.src !== undefined) {
                    const newImg = document.createElement("img");
                    for (let i = 0; i < element.attributes.length; i++) {
                        const attr = element.attributes[i];
                        newImg.setAttribute(attr.name, attr.value);
                    }
                    newImg.src = imageData.src;
                    element.replaceWith(newImg);
                    elements.set(key, { element: newImg, groupId: info.groupId, type: info.type });
                    return;
                }
            } else if (info.type === "text") {
                const textData = data as { value?: string };
                if (textData.value !== undefined) {
                    element.textContent = textData.value;
                    return;
                }
            } else if (info.type === "html") {
                const htmlData = data as { value?: string };
                if (htmlData.value !== undefined) {
                    element.innerHTML = htmlData.value;
                    return;
                }
            }
        } catch {
            // Not JSON - ignore, content should always be JSON
        }
    }

    /**
     * Populate DOM elements with fetched content (handles grouped response)
     * Response uses key-value format: { elements: { [elementId]: { content } }, groups: { [groupId]: { elements: { [elementId]: { content } } } } }
     */
    function populateContent(
        elements: Map<string, EditableElementInfo>,
        data: {
            elements: Record<string, { content: string }>;
            groups: Record<string, { elements: Record<string, { content: string }> }>;
        }
    ): void {
        // Populate ungrouped elements
        Object.entries(data.elements).forEach(([elementId, element]) => {
            updateElement(elements, elementId, element.content);
        });

        // Populate grouped elements
        Object.entries(data.groups).forEach(([groupId, group]) => {
            Object.entries(group.elements).forEach(([elementId, element]) => {
                // Use composite key: groupId:elementId
                updateElement(elements, `${groupId}:${elementId}`, element.content);
            });
        });
    }

    /**
     * Remove hiding styles to reveal content
     */
    function removeHidingStyles(): void {
        style.remove();
    }

    /**
     * Content response type (key-value format)
     */
    interface ContentResponse {
        elements: Record<string, { content: string }>;
        groups: Record<string, { elements: Record<string, { content: string }> }>;
    }

    /**
     * Fetch content from API
     * Returns null on any error (page will show default content)
     */
    async function fetchContent(): Promise<ContentResponse | null> {
        try {
            const url = `${apiUrl}/apps/${appId}/content`;
            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 404) {
                    // No content yet - that's fine
                    return null;
                }
                if (response.status === 403) {
                    console.warn("[StreamlinedCMS] Domain not whitelisted for this app");
                    return null;
                }
                throw new Error(`Failed to load content: ${response.status}`);
            }

            return await response.json() as ContentResponse;
        } catch (error) {
            console.warn("[StreamlinedCMS] Could not load content:", error);
            return null;
        }
    }

    /**
     * Initialize: fetch content, populate DOM, then load lazy module
     */
    async function initialize(): Promise<void> {
        // Start fetch immediately (can run before DOM is ready)
        const contentPromise = fetchContent();

        // Wait for DOM to be ready
        if (document.readyState === "loading") {
            await new Promise<void>((resolve) => {
                document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
            });
        }

        // Scan DOM and populate with fetched content
        const elements = scanEditableElements();
        const content = await contentPromise;

        if (content && elements.size > 0) {
            populateContent(elements, content);
        }

        // Reveal content
        removeHidingStyles();

        // Now load lazy module for auth/editing features
        injectEsmModule();
    }

    // Start initialization
    initialize();
})();
