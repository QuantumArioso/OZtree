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
    
    // Global options variable
    var options = {
        enableNotification: true,
        notificationText: 'External links are disabled in kiosk mode',
        greyOutLinks: true,
        removeTargetBlank: true,
        disableIframeLinks: false
    };
    
    /**
     * Show notification to user
     */
    function showNotification(message) {
        if (!options.enableNotification) return;
        
        // Create notification element if it doesn't exist
        var notification = document.getElementById('kiosk-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'kiosk-notification';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #f44336;
                color: white;
                padding: 12px 16px;
                border-radius: 4px;
                z-index: 10000;
                font-family: Arial, sans-serif;
                font-size: 14px;
                max-width: 300px;
                opacity: 0;
                transition: opacity 0.3s;
            `;
            document.body.appendChild(notification);
        }
        
        notification.textContent = message || options.notificationText;
        notification.style.opacity = '1';
        
        // Auto-hide after 3 seconds
        setTimeout(function() {
            notification.style.opacity = '0';
        }, 3000);
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
            
            // For kiosk mode: OneZoom tour assets should be disabled but not grayed out
            // So we treat them as "external" to disable the links, but handle styling specially
            
            // Allow other OneZoom domains (like images.onezoom.org for the image server)
            if (url.indexOf('images.onezoom.org') !== -1) {
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
        
        // Add styling to show it's disabled, but preserve tour image appearance
        element.classList.add('disabled-external-link');
        
        // Only apply gray styling to non-tour content
        if (!element.classList.contains('embed-image') && !element.classList.contains('copyright')) {
            element.style.color = '#999';
            element.style.cursor = 'default';
            element.style.textDecoration = 'none';
        } else {
            // For tour images, just change cursor and prevent default styling
            element.style.cursor = 'not-allowed';
            // Don't change color or text decoration for tour content
        }
        
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
                            
                            // Check for YouTube embeds within the added node (for tour content)
                            if (options.disableIframeLinks) {
                                var youtubeIframes = node.querySelectorAll ? node.querySelectorAll('iframe.embed-youtube') : [];
                                for (var i = 0; i < youtubeIframes.length; i++) {
                                    disableYouTubeEmbed(youtubeIframes[i]);
                                }
                                
                                // Also check if the node itself is a YouTube iframe
                                if (node.tagName === 'IFRAME' && node.classList.contains('embed-youtube')) {
                                    disableYouTubeEmbed(node);
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
            // Special handling for YouTube embeds
            if (iframe.classList.contains('embed-youtube')) {
                disableYouTubeEmbed(iframe);
                return;
            }
            
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
    
    // Special handling for YouTube embeds
    function disableYouTubeEmbed(iframe) {
        // Create a comprehensive overlay to block all YouTube interactions
        addComprehensiveYouTubeOverlay(iframe);
        
        // Also try to modify the URL to disable YouTube features and controls
        try {
            let src = iframe.src;
            if (src.includes('youtube.com/embed/')) {
                const url = new URL(src);
                
                // Add parameters to disable YouTube features that link externally
                url.searchParams.set('rel', '0');          // Don't show related videos
                url.searchParams.set('showinfo', '0');     // Don't show video info
                url.searchParams.set('iv_load_policy', '3'); // Don't show annotations
                url.searchParams.set('modestbranding', '1'); // Minimal YouTube branding
                url.searchParams.set('disablekb', '1');     // Disable keyboard controls
                url.searchParams.set('fs', '0');           // Disable fullscreen
                url.searchParams.set('controls', '0');     // Completely disable controls (no pause/play/seek)
                url.searchParams.set('autoplay', '1');     // Auto-start the video
                
                // Update the iframe source
                iframe.src = url.toString();
            }
        } catch(e) {
            console.log('Could not modify YouTube URL:', e);
        }
    }
    
    // Add comprehensive overlay for YouTube to prevent ALL external navigation
    function addComprehensiveYouTubeOverlay(iframe) {
        if (iframe.youtubeOverlayAdded) return; // Prevent duplicate overlays
        
        // Wait for iframe to load before adding overlay
        setTimeout(() => {
            const container = iframe.closest('.embed-video') || iframe.parentElement;
            if (!container) return;
            
            // Make container relatively positioned
            container.style.position = 'relative';
            container.style.overflow = 'hidden';
            
            // Create a single full overlay since controls are disabled
            const overlay = document.createElement('div');
            overlay.className = 'youtube-kiosk-full-overlay';
            overlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 1001;
                pointer-events: auto;
                background: transparent;
                cursor: not-allowed;
            `;
            
            // Add click handler to show notification
            overlay.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                showNotification('Video interaction is disabled in kiosk mode');
                return false;
            });
            
            // Block all mouse events
            ['mousedown', 'mouseup', 'mousemove', 'contextmenu'].forEach(eventType => {
                overlay.addEventListener(eventType, function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                });
            });
            
            // Add overlay to container
            container.appendChild(overlay);
            iframe.youtubeOverlayAdded = true;
            
            console.log('YouTube full overlay added for kiosk mode - no interaction allowed');
        }, 2000); // Give YouTube time to load
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
    
    // Expose the main KioskMode object globally
    window.KioskMode = {
        init: init,
        isExternalUrl: isExternalUrl,
        disableExternalLink: disableExternalLink,
        processAllLinks: processAllLinks,
        disableYouTubeEmbed: disableYouTubeEmbed,
        disableIframeLinks: disableIframeLinks,
        addComprehensiveYouTubeOverlay: addComprehensiveYouTubeOverlay
    };
    
    // Also expose utilities for manual use (backwards compatibility)
    window.OneZoomKioskMode = {
        isExternalUrl: isExternalUrl,
        disableExternalLink: disableExternalLink,
        processAllLinks: processAllLinks
    };
    
})();
