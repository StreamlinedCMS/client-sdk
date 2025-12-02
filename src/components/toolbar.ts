/**
 * Toolbar Component
 *
 * A full-width bottom toolbar for editing mode.
 * - Desktop: shows all actions inline
 * - Mobile: collapses secondary actions into expandable drawer
 *
 * Primary actions (always visible): Save, Reset
 * Secondary actions (collapsible on mobile): Mode toggle, Edit HTML, Sign Out
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { tailwindSheet } from "./styles.js";
import type { EditorMode } from "./mode-toggle.js";
import "./mode-toggle.js";
import "./element-badge.js";
import "./hold-button.js";

export type { EditorMode };

@customElement("scms-toolbar")
export class Toolbar extends LitElement {
    @property({ type: String })
    mode: EditorMode = "viewer";

    @property({ type: String, attribute: "active-element" })
    activeElement: string | null = null;

    @property({ type: Boolean, attribute: "has-changes" })
    hasChanges = false;

    @property({ type: Boolean })
    saving = false;

    @state()
    private expanded = false;

    @state()
    private isMobile = false;

    private resizeObserver: ResizeObserver | null = null;

    static styles = [
        tailwindSheet,
        css`
            :host {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                z-index: 2147483647;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
        `,
    ];

    connectedCallback() {
        super.connectedCallback();
        this.checkMobile();
        this.resizeObserver = new ResizeObserver(() => this.checkMobile());
        this.resizeObserver.observe(document.body);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.resizeObserver?.disconnect();
    }

    private checkMobile() {
        this.isMobile = window.innerWidth < 640;
        if (!this.isMobile) {
            this.expanded = false;
        }
    }

    private toggleExpanded() {
        this.expanded = !this.expanded;
    }

    private handleModeChange(newMode: EditorMode) {
        if (newMode !== this.mode) {
            this.mode = newMode;
            this.dispatchEvent(
                new CustomEvent("mode-change", {
                    detail: { mode: newMode },
                    bubbles: true,
                    composed: true,
                })
            );
        }
    }

    private handleSave() {
        this.dispatchEvent(
            new CustomEvent("save", {
                bubbles: true,
                composed: true,
            })
        );
    }

    private handleReset() {
        this.dispatchEvent(
            new CustomEvent("reset", {
                bubbles: true,
                composed: true,
            })
        );
    }

    private handleEditHtml() {
        this.dispatchEvent(
            new CustomEvent("edit-html", {
                bubbles: true,
                composed: true,
            })
        );
    }

    private handleSignOut() {
        this.dispatchEvent(
            new CustomEvent("sign-out", {
                bubbles: true,
                composed: true,
            })
        );
    }

    private renderModeToggle() {
        return html`
            <scms-mode-toggle
                .mode=${this.mode}
                @mode-change=${(e: CustomEvent<{ mode: EditorMode }>) => this.handleModeChange(e.detail.mode)}
            ></scms-mode-toggle>
        `;
    }

    private renderEditHtmlButton() {
        if (!this.activeElement) return nothing;
        return html`
            <button
                class="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                @click=${this.handleEditHtml}
            >
                Edit HTML
            </button>
        `;
    }

    private renderResetButton() {
        if (!this.activeElement) return nothing;
        return html`
            <scms-hold-button
                label="Reset"
                hold-duration="800"
                @hold-complete=${this.handleReset}
            ></scms-hold-button>
        `;
    }

    private renderSignOutButton() {
        return html`
            <button
                class="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
                @click=${this.handleSignOut}
            >
                Sign Out
            </button>
        `;
    }

    private renderSaveButton() {
        if (!this.hasChanges) return nothing;

        const saveClasses = this.saving
            ? "px-4 py-1.5 text-xs font-medium rounded-md transition-colors bg-red-400 text-white cursor-not-allowed"
            : "px-4 py-1.5 text-xs font-medium rounded-md transition-colors bg-red-600 text-white hover:bg-red-700";

        return html`
            <button
                class=${saveClasses}
                ?disabled=${this.saving}
                @click=${this.handleSave}
            >
                ${this.saving ? "Saving..." : "Save"}
            </button>
        `;
    }

    private renderActiveElement() {
        return html`<scms-element-badge element-id=${this.activeElement || ""}></scms-element-badge>`;
    }

    private renderDesktop() {
        return html`
            <div class="h-12 bg-white border-t border-gray-200 shadow-lg">
                <div class="h-full max-w-screen-xl mx-auto px-4 flex items-center justify-between">
                    <!-- Left: Mode toggle -->
                    <div class="flex items-center gap-3">
                        ${this.renderModeToggle()}
                    </div>

                    <!-- Center: Reset + Active element + Edit HTML -->
                    <div class="flex items-center gap-3">
                        ${this.renderResetButton()}
                        ${this.renderActiveElement()}
                        ${this.renderEditHtmlButton()}
                    </div>

                    <!-- Right: Save + Sign Out (separated) -->
                    <div class="flex items-center">
                        ${this.renderSaveButton()}
                        <div class="ml-6 pl-6 border-l border-gray-200">
                            ${this.renderSignOutButton()}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    private renderMobile() {
        return html`
            <div class="bg-white border-t border-gray-200 shadow-lg">
                <!-- Primary bar (always visible, at top) -->
                <div class="h-14 px-4 flex items-center justify-between border-b border-gray-100">
                    <!-- Menu toggle (left) -->
                    <button
                        class="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                        @click=${this.toggleExpanded}
                        aria-label=${this.expanded ? "Close menu" : "Open menu"}
                    >
                        ${this.expanded
                            ? html`
                                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            `
                            : html`
                                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            `}
                    </button>

                    <!-- Center: Element badge + Edit HTML -->
                    <div class="flex-1 flex items-center justify-center gap-2">
                        ${this.renderActiveElement()}
                        ${this.renderEditHtmlButton()}
                    </div>

                    <!-- Save (right) -->
                    <div class="flex items-center">
                        ${this.renderSaveButton()}
                    </div>
                </div>

                <!-- Expandable drawer (secondary actions + sign out) -->
                <div
                    class="overflow-hidden transition-all duration-200 ease-out"
                    style="max-height: ${this.expanded ? "200px" : "0"}"
                >
                    <div class="px-4 py-3 space-y-3">
                        <!-- Reset (only when element selected) -->
                        ${this.activeElement
                            ? html`
                                <div class="flex items-center justify-between">
                                    <span class="text-xs font-medium text-gray-700">Reset element</span>
                                    ${this.renderResetButton()}
                                </div>
                            `
                            : nothing}
                        <!-- Mode toggle -->
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-medium text-gray-700">Mode</span>
                            ${this.renderModeToggle()}
                        </div>
                        <!-- Sign Out (separated at bottom, centered) -->
                        <div class="pt-2 mt-2 border-t border-gray-200 flex justify-center">
                            <button
                                class="px-3 py-2 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
                                @click=${this.handleSignOut}
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    render() {
        return this.isMobile ? this.renderMobile() : this.renderDesktop();
    }

    /**
     * Get the toolbar height for body padding calculation
     */
    getHeight(): number {
        if (this.isMobile) {
            return this.expanded ? 14 * 4 + 120 : 14 * 4; // 56px base, ~120px drawer
        }
        return 12 * 4; // 48px
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "scms-toolbar": Toolbar;
    }
}
