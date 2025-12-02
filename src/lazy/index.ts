/**
 * Lazy-loaded module for auth and UI
 *
 * This module is loaded AFTER the critical path completes (content visible).
 * It contains:
 * - Loganite logger (for detailed logging)
 * - Auth module (API key management, login popup)
 * - Lit web components (sign-in link, toolbar)
 * - Editing functionality
 */

import { Logger } from "loganite";
import { Auth, type EditorMode } from "../auth.js";
import { getConfigFromScriptTag, type ViewerConfig } from "../viewer/config.js";

// Import Lit components to register them
import "../components/toolbar.js";
import "../components/sign-in-link.js";
import "../components/html-editor-modal.js";
import type { Toolbar } from "../components/toolbar.js";
import type { HtmlEditorModal } from "../components/html-editor-modal.js";

// Toolbar height constants
const TOOLBAR_HEIGHT_DESKTOP = 48;
const TOOLBAR_HEIGHT_MOBILE = 56;

class EditorController {
    private config: ViewerConfig;
    private log: Logger;
    private auth: Auth;
    private apiKey: string | null = null;
    private currentMode: EditorMode = "viewer";
    private editableElements: Map<string, HTMLElement> = new Map();
    private originalContent: Map<string, string> = new Map();
    private editingElementId: string | null = null;
    private customSignInTrigger: Element | null = null;
    private customSignInOriginalText: string | null = null;
    private toolbar: Toolbar | null = null;
    private htmlEditorModal: HtmlEditorModal | null = null;
    private saving = false;

    constructor(config: ViewerConfig) {
        this.config = config;

        // Create logger with configured level
        const logLevel = config.logLevel || "error";
        this.log = new Logger("StreamlinedCMS", logLevel);

        // Initialize auth module
        this.auth = new Auth({
            appId: config.appId,
            appUrl: config.appUrl,
        });
    }

    async init(): Promise<void> {
        this.log.info("Lazy module initializing", {
            appId: this.config.appId,
        });

        // Re-scan editable elements (viewer already populated them)
        this.scanEditableElements();

        // Check for mock auth
        if (this.config.mockAuth?.enabled) {
            this.apiKey = "mock-api-key";
            this.log.debug("Mock authentication enabled");
            this.setMode("author");
            return;
        }

        // Set up auth UI based on stored state
        this.setupAuthUI();

        this.log.info("Lazy module initialized", {
            editableCount: this.editableElements.size,
            hasApiKey: !!this.apiKey,
            mode: this.currentMode,
        });
    }

    private scanEditableElements(): void {
        document.querySelectorAll<HTMLElement>("[data-editable]").forEach((element) => {
            const elementId = element.getAttribute("data-editable");
            if (elementId) {
                this.editableElements.set(elementId, element);
            }
        });
    }

    private setupAuthUI(): void {
        const storedKey = this.auth.getStoredKey();

        if (storedKey) {
            this.apiKey = storedKey;

            // Set up custom trigger as sign-out if present
            const customTrigger = document.querySelector("[data-scms-signin]");
            if (customTrigger) {
                this.customSignInTrigger = customTrigger;
                this.customSignInOriginalText = customTrigger.textContent;
                customTrigger.textContent = "Sign Out";
                customTrigger.addEventListener("click", this.handleSignOutClick);
            }

            const storedMode = this.auth.getStoredMode();
            this.setMode(storedMode === "author" ? "author" : "viewer");
            this.log.debug("Restored auth state", { mode: this.currentMode });
        } else {
            this.showSignInLink();
            this.log.debug("No valid API key, showing sign-in link");
        }
    }

    private showSignInLink(): void {
        this.removeToolbar();

        // Check for custom trigger
        const customTrigger = document.querySelector("[data-scms-signin]");
        if (customTrigger) {
            this.customSignInTrigger = customTrigger;
            this.customSignInOriginalText = customTrigger.textContent;

            // Restore original text if it was changed
            if (this.customSignInOriginalText) {
                customTrigger.textContent = this.customSignInOriginalText;
            }

            customTrigger.addEventListener("click", this.handleSignInClick);
            return;
        }

        // Use Lit component
        const signInLink = document.createElement("scms-sign-in-link");
        signInLink.id = "scms-signin-link";
        signInLink.addEventListener("sign-in-click", () => {
            this.handleSignIn();
        });
        document.body.appendChild(signInLink);
    }

    private handleSignInClick = (e: Event): void => {
        e.preventDefault();
        this.handleSignIn();
    };

    private handleSignOutClick = (e: Event): void => {
        e.preventDefault();
        this.signOut();
    };

    private handleDocumentClick = (e: Event): void => {
        if (!this.editingElementId) return;

        const target = e.target as Node;

        // Don't deselect if clicking inside an editable element
        for (const element of this.editableElements.values()) {
            if (element.contains(target)) {
                return;
            }
        }

        // Don't deselect if clicking inside the toolbar
        if (this.toolbar?.contains(target)) {
            return;
        }

        this.stopEditing();
    };

    private async handleSignIn(): Promise<void> {
        this.log.debug("Opening login popup");

        const key = await this.auth.openLoginPopup();
        if (key) {
            this.apiKey = key;

            // Remove default sign-in link if present
            const signInLink = document.getElementById("scms-signin-link");
            if (signInLink) signInLink.remove();

            // Convert custom trigger to sign-out
            if (this.customSignInTrigger) {
                this.customSignInTrigger.removeEventListener("click", this.handleSignInClick);
                this.customSignInTrigger.textContent = "Sign Out";
                this.customSignInTrigger.addEventListener("click", this.handleSignOutClick);
            }

            this.setMode("author");
            this.log.info("User authenticated via popup, entering author mode");
        } else {
            this.log.debug("Login popup closed without authentication");
        }
    }

    private setMode(mode: EditorMode): void {
        this.currentMode = mode;
        this.auth.storeMode(mode);

        if (mode === "author") {
            this.enableAuthorMode();
        } else {
            this.enableViewerMode();
        }

        // Update toolbar mode
        if (this.toolbar) {
            this.toolbar.mode = mode;
        }
    }

    private enableAuthorMode(): void {
        this.log.debug("Entering author mode");

        this.editableElements.forEach((element, elementId) => {
            element.classList.add("streamlined-editable");

            if (!element.dataset.scmsClickHandler) {
                element.addEventListener("click", (e) => {
                    if (this.currentMode === "author") {
                        e.preventDefault();
                        e.stopPropagation();
                        this.startEditing(elementId);
                    }
                });
                element.dataset.scmsClickHandler = "true";
            }
        });

        // Add click-outside handler to deselect elements
        document.addEventListener("click", this.handleDocumentClick);

        this.injectEditStyles();
        this.showToolbar();
    }

    private enableViewerMode(): void {
        this.log.debug("Entering viewer mode");

        this.editableElements.forEach((element) => {
            element.classList.remove("streamlined-editable", "streamlined-editing");
            element.removeAttribute("contenteditable");
        });

        // Remove click-outside handler
        document.removeEventListener("click", this.handleDocumentClick);

        this.stopEditing();
        this.showToolbar();
    }

    private showToolbar(): void {
        // Update existing toolbar if present
        if (this.toolbar) {
            this.toolbar.mode = this.currentMode;
            this.toolbar.activeElement = this.editingElementId;
            return;
        }

        // Create new toolbar
        const toolbar = document.createElement("scms-toolbar") as Toolbar;
        toolbar.id = "scms-toolbar";
        toolbar.mode = this.currentMode;
        toolbar.activeElement = this.editingElementId;

        toolbar.addEventListener("mode-change", ((e: CustomEvent<{ mode: EditorMode }>) => {
            this.setMode(e.detail.mode);
        }) as EventListener);

        toolbar.addEventListener("save", () => {
            this.handleSave();
        });

        toolbar.addEventListener("reset", () => {
            this.handleReset();
        });

        toolbar.addEventListener("edit-html", () => {
            this.handleEditHtml();
        });

        toolbar.addEventListener("sign-out", () => {
            this.signOut();
        });

        document.body.appendChild(toolbar);
        this.toolbar = toolbar;

        // Add body padding to prevent content overlap
        this.updateBodyPadding();
        window.addEventListener("resize", this.updateBodyPadding);
    }

    private updateBodyPadding = (): void => {
        const isMobile = window.innerWidth < 640;
        const height = isMobile ? TOOLBAR_HEIGHT_MOBILE : TOOLBAR_HEIGHT_DESKTOP;
        document.body.style.paddingBottom = `${height}px`;
    };

    private removeToolbar(): void {
        if (this.toolbar) {
            this.toolbar.remove();
            this.toolbar = null;
            document.body.style.paddingBottom = "";
            window.removeEventListener("resize", this.updateBodyPadding);
        }
    }

    private signOut(): void {
        this.log.info("Signing out");

        this.auth.clearStoredKey();
        this.apiKey = null;

        this.editableElements.forEach((element) => {
            element.classList.remove("streamlined-editable", "streamlined-editing");
            element.removeAttribute("contenteditable");
        });
        this.stopEditing();

        // Convert custom trigger back to sign-in
        if (this.customSignInTrigger) {
            this.customSignInTrigger.removeEventListener("click", this.handleSignOutClick);
            if (this.customSignInOriginalText) {
                this.customSignInTrigger.textContent = this.customSignInOriginalText;
            }
            this.customSignInTrigger.addEventListener("click", this.handleSignInClick);
        }

        this.removeToolbar();

        // Only show default sign-in link if no custom trigger
        if (!this.customSignInTrigger) {
            this.showSignInLink();
        }
    }

    private injectEditStyles(): void {
        if (document.getElementById("streamlined-cms-styles")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "streamlined-cms-styles";
        style.textContent = `
            .streamlined-editable {
                outline: 2px dashed transparent;
                outline-offset: 2px;
                transition: outline 0.2s;
                cursor: pointer;
                position: relative;
            }

            .streamlined-editable:hover {
                outline-color: #ef4444;
            }

            .streamlined-editing {
                outline: 2px solid #ef4444;
                outline-offset: 2px;
            }
        `;
        document.head.appendChild(style);
    }

    private startEditing(elementId: string): void {
        const element = this.editableElements.get(elementId);
        if (!element) {
            this.log.warn("Element not found", { elementId });
            return;
        }

        this.log.trace("Starting edit", { elementId });

        // Stop editing previous element if any
        if (this.editingElementId) {
            const prevElement = this.editableElements.get(this.editingElementId);
            if (prevElement) {
                prevElement.classList.remove("streamlined-editing");
                prevElement.setAttribute("contenteditable", "false");
            }
        }

        // Store original content for reset
        if (!this.originalContent.has(elementId)) {
            this.originalContent.set(elementId, element.innerHTML);
        }

        // Add input listener to track changes
        if (!element.dataset.scmsInputHandler) {
            element.addEventListener("input", () => this.updateToolbarHasChanges());
            element.dataset.scmsInputHandler = "true";
        }

        this.editingElementId = elementId;
        element.classList.add("streamlined-editing");
        element.setAttribute("contenteditable", "true");
        element.focus();

        // Update toolbar
        if (this.toolbar) {
            this.toolbar.activeElement = elementId;
        }
    }

    private stopEditing(): void {
        if (!this.editingElementId) {
            return;
        }

        this.log.trace("Stopping edit");

        const element = this.editableElements.get(this.editingElementId);
        if (element) {
            element.classList.remove("streamlined-editing");
            element.setAttribute("contenteditable", "false");
        }

        this.editingElementId = null;

        // Update toolbar
        if (this.toolbar) {
            this.toolbar.activeElement = null;
        }
    }

    private getDirtyElements(): Map<string, string> {
        const dirty = new Map<string, string>();
        this.editableElements.forEach((element, elementId) => {
            const original = this.originalContent.get(elementId);
            const current = element.innerHTML;
            if (original !== undefined && current !== original) {
                dirty.set(elementId, current);
            }
        });
        return dirty;
    }

    private updateToolbarHasChanges(): void {
        if (this.toolbar) {
            this.toolbar.hasChanges = this.getDirtyElements().size > 0;
        }
    }

    private async handleSave(): Promise<void> {
        const dirtyElements = this.getDirtyElements();
        if (dirtyElements.size === 0 || this.saving) {
            return;
        }

        this.log.debug("Saving all dirty elements", { count: dirtyElements.size });

        this.saving = true;
        if (this.toolbar) {
            this.toolbar.saving = true;
        }

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers["Authorization"] = `Bearer ${this.apiKey}`;
        }

        const errors: string[] = [];
        const saved: string[] = [];

        try {
            // Save all dirty elements in parallel
            const savePromises = Array.from(dirtyElements.entries()).map(
                async ([elementId, content]) => {
                    const url = `${this.config.apiUrl}/apps/${this.config.appId}/content/${elementId}`;
                    const response = await fetch(url, {
                        method: "PUT",
                        headers,
                        body: JSON.stringify({ content }),
                    });

                    if (!response.ok) {
                        throw new Error(`${elementId}: ${response.status} ${response.statusText}`);
                    }

                    await response.json();

                    // Update original content to saved version
                    this.originalContent.set(elementId, content);
                    saved.push(elementId);
                }
            );

            const results = await Promise.allSettled(savePromises);

            results.forEach((result) => {
                if (result.status === "rejected") {
                    errors.push(result.reason?.message || "Unknown error");
                }
            });

            this.auth.refreshKeyExpiry();

            if (errors.length > 0) {
                this.log.error("Some elements failed to save", { errors });
                alert(`Failed to save some elements:\n${errors.join("\n")}`);
            } else {
                this.log.info("All content saved", { count: saved.length });
                // Deselect element after successful save
                this.stopEditing();
            }

            // Update toolbar
            this.updateToolbarHasChanges();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log.error("Failed to save content", error);
            alert(`Failed to save: ${errorMessage}\n\nCheck console for details.`);
        } finally {
            this.saving = false;
            if (this.toolbar) {
                this.toolbar.saving = false;
            }
        }
    }

    private handleReset(): void {
        if (!this.editingElementId) {
            return;
        }

        const elementId = this.editingElementId;
        const element = this.editableElements.get(elementId);
        const originalContent = this.originalContent.get(elementId);

        if (element && originalContent !== undefined) {
            this.log.debug("Resetting element", { elementId });
            element.innerHTML = originalContent;
            this.updateToolbarHasChanges();
        }
    }

    private handleEditHtml(): void {
        if (!this.editingElementId) {
            this.log.debug("No element selected for HTML editing");
            return;
        }

        // Prevent opening multiple modals
        if (this.htmlEditorModal) {
            this.log.debug("HTML editor already open");
            return;
        }

        const element = this.editableElements.get(this.editingElementId);
        if (!element) {
            return;
        }

        this.log.debug("Opening HTML editor", { elementId: this.editingElementId });

        // Create and show modal
        const modal = document.createElement("scms-html-editor-modal") as HtmlEditorModal;
        modal.elementId = this.editingElementId;
        modal.content = element.innerHTML;

        // Prevent clicks inside modal from deselecting the element
        modal.addEventListener("click", (e: Event) => {
            e.stopPropagation();
        });

        modal.addEventListener("apply", ((e: CustomEvent<{ content: string }>) => {
            element.innerHTML = e.detail.content;
            this.closeHtmlEditor();
            this.updateToolbarHasChanges();
            this.log.debug("HTML applied", { elementId: this.editingElementId });
        }) as EventListener);

        modal.addEventListener("cancel", () => {
            this.closeHtmlEditor();
        });

        document.body.appendChild(modal);
        this.htmlEditorModal = modal;
    }

    private closeHtmlEditor(): void {
        if (this.htmlEditorModal) {
            this.htmlEditorModal.remove();
            this.htmlEditorModal = null;
        }
    }
}

/**
 * Initialize the lazy-loaded functionality
 */
export async function initLazy(config: ViewerConfig): Promise<void> {
    const controller = new EditorController(config);
    await controller.init();
}

// Auto-initialize when loaded directly
const config = getConfigFromScriptTag();
if (config) {
    initLazy(config);
}
