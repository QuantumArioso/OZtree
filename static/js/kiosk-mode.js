/**
 * JavaScript utilities for disabling external links in OneZoom kiosk mode
 * This provides client-side enforcement of the external link policy
 */

(function() {
    'use strict';
    
    // Check if external links should be disabled
    // This should be set by the server-side template
    var DISABLE_EXTERNAL_LINKS = window.OZ_DISABLE_EXTERNAL_LINKS || false;
    
    if (!DISABLE_EXTERNAL_LINKS) {
        return; // External links are allowed, do nothing
    }
    
    /**
     * Check if a URL is external
     */
    function isExternalUrl(url) {
        if (!url) return false;
        
        // Handle different URL formats
        url = url.toString().trim();
        
        // Absolute URLs with protocols
        if (/^https?:\/\//.test(url) || /^ftp:\/\//.test(url) || /^\/\//.test(url)) {
            // Check if it's pointing to our own domain
            var currentHost = window.location.host;
            if (url.indexOf(currentHost) !== -1) {
                return false;
            }
            return true;
        }
        
        // JavaScript URLs that open external content
        if (/^javascript:/.test(url)) {
            if (/window\.open|location\.href/.test(url)) {
                return true;
            }
        }
        
        // Fragment, relative, or query URLs are internal
        if (/^[#\/\?.]/.test(url)) {
            return false;
        }
        
        // URLs with dots (likely external domains)
        if (url.indexOf('.') !== -1 && !url.startsWith('.')) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Disable an external link element
     */
    function disableExternalLink(element) {
        // Remove href to make it non-clickable
        element.removeAttribute('href');
        
        // Add styling to show it's disabled
        element.classList.add('disabled-external-link');
        element.style.color = '#999';
        element.style.cursor = 'default';
        element.style.textDecoration = 'none';
        
        // Add title to explain why it's disabled
        element.title = 'External links are disabled in kiosk mode';
        
        // Prevent any click events
        element.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        });
    }
    
    /**
     * Process all links on page load
     */
    function processAllLinks() {
        var links = document.querySelectorAll('a[href]');
        
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var href = link.getAttribute('href');
            
            if (isExternalUrl(href)) {
                disableExternalLink(link);
            }
        }
    }
    
    /**
     * Set up mutation observer to catch dynamically added links
     */
    function setupMutationObserver() {
        if (typeof MutationObserver === 'undefined') {
            return; // Not supported in old browsers
        }
        
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) { // Element node
                            // Check if the node itself is a link
                            if (node.tagName === 'A' && node.hasAttribute('href')) {
                                var href = node.getAttribute('href');
                                if (isExternalUrl(href)) {
                                    disableExternalLink(node);
                                }
                            }
                            
                            // Check for links within the added node
                            var links = node.querySelectorAll ? node.querySelectorAll('a[href]') : [];
                            for (var i = 0; i < links.length; i++) {
                                var link = links[i];
                                var href = link.getAttribute('href');
                                if (isExternalUrl(href)) {
                                    disableExternalLink(link);
                                }
                            }
                        }
                    });
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    /**
     * Override window.open to prevent external windows
     */
    function disableWindowOpen() {
        var originalOpen = window.open;
        window.open = function(url) {
            if (isExternalUrl(url)) {
                console.log('External window.open blocked in kiosk mode:', url);
                return null;
            }
            return originalOpen.apply(window, arguments);
        };
    }
    
    // Handle iframe content (for external sites like Wikipedia, EOL)
    function disableIframeLinks() {
        if (!options.disableIframeLinks) return;
        
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(function(iframe) {
            try {
                iframe.addEventListener('load', function() {
                    try {
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                        if (iframeDoc) {
                            // Disable all links within the iframe
                            const links = iframeDoc.querySelectorAll('a');
                            links.forEach(function(link) {
                                link.addEventListener('click', function(e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    showNotification('External links are disabled');
                                    return false;
                                });
                                link.classList.add('external-link-disabled');
                            });
                            
                            // Also disable form submissions that might navigate away
                            const forms = iframeDoc.querySelectorAll('form');
                            forms.forEach(function(form) {
                                form.addEventListener('submit', function(e) {
                                    e.preventDefault();
                                    showNotification('External navigation is disabled');
                                    return false;
                                });
                            });
                        }
                    } catch(e) {
                        // Cross-origin iframe - can't access content
                        console.log('Cannot access iframe content (cross-origin):', e);
                        // For cross-origin iframes, we could add a click overlay
                        addIframeOverlay(iframe);
                    }
                });
            } catch(e) {
                console.log('Error setting up iframe link disabling:', e);
            }
        });
    }
    
    // Add overlay to prevent interaction with cross-origin iframes
    function addIframeOverlay(iframe) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1000;
            cursor: not-allowed;
            background: rgba(255,255,255,0.1);
            pointer-events: auto;
        `;
        
        overlay.addEventListener('click', function(e) {
            e.preventDefault();
            showNotification('External navigation is disabled in kiosk mode');
            return false;
        });
        
        // Position the iframe container relatively
        if (iframe.parentElement) {
            iframe.parentElement.style.position = 'relative';
            iframe.parentElement.appendChild(overlay);
        }
    }

    /**
     * Initialize external link blocking
     */
    function init(userOptions) {
        options = Object.assign({
            enableNotification: true,
            notificationText: 'External links are disabled in kiosk mode',
            greyOutLinks: true,
            removeTargetBlank: true,
            disableIframeLinks: false // New option for iframe handling
        }, userOptions || {});

        // Process existing links
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', processAllLinks);
        } else {
            processAllLinks();
        }
        
        // Set up observers for dynamic content
        setupMutationObserver();
        
        // Disable window.open for external URLs
        disableWindowOpen();
        
        if (options.disableIframeLinks) {
            disableIframeLinks();
        }
        
        console.log('OneZoom: External link blocking enabled for kiosk mode');
    }
    
    // Initialize when script loads
    init();
    
    // Expose utilities for manual use
    window.OneZoomKioskMode = {
        isExternalUrl: isExternalUrl,
        disableExternalLink: disableExternalLink,
        processAllLinks: processAllLinks
    };
    
})();
