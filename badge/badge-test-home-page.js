badgeTitleHomePageSelectors = 'div[class*="__product_title_"], ' + // Horizon
    '[id^="title-template"], ' + // Dawn
    '[id^="title--"], ' + // Dawn - Search Page
    '.grid-product__title, ' + //Impulse
    '.product-item-meta__title, ' + //Quatz
    '.product-title, ' + //Prestige
    '.product-item__title, ' + //Mesh
    '.grid-product__title' //Chat GPT

badgeBelowPriceHomePageSelectors = '.card-information .price, ' +//Dawn
    'product-price.text-block, ' + //Horizon
    '.grid-product .grid-product__price, ' + //Impulse
    '.product-item-meta__price-list-container, ' + // Quartz
    '.product-card__info .price-list, ' + //Balance, Prestige
    '.product-item .price-list, ' + //Ivory
    '.product-item__info .price-list' //Mesh

badgeBeforeAfterPriceHomePageSelectors =
    '.card-information .price__container, ' +//Dawn
    'product-price.text-block, ' + //Horizon
    '.grid-product .grid-product__price, ' + //Impulse
    '.product-item-meta__price-list-container .price-list, ' + // Quartz
    '.product-card__info .price-list, ' + //Balance, Prestige
    '.product-item .price-list, ' + //Ivory
    '.product-item__info .price-list' //Mesh

function findProductIdFromMedia(media) {
    if (!media) return null;

    let productId = null;

    // Step A: find first element with data-product-id (including media itself)
    let wrapper = media.matches?.("[data-product-id]")
        ? media
        : media.querySelector("[data-product-id]");

    if (wrapper) {
        productId = wrapper.getAttribute("data-product-id");
    }

    // Step B: find first element with product-id attribute
    if (!productId) {
        wrapper = media.matches?.("[product-id]")
            ? media
            : media.querySelector("[product-id]");

        if (wrapper) {
            productId = wrapper.getAttribute("product-id");
        }
    }

    // Step C: hidden input name="product-id"
    if (!productId) {
        const input = media.querySelector(
            'input[name="product-id"], input[name="product_id"]'
        );

        if (input) {
            productId = input.value;
        }
    }

    // Step D: extract from link id
    if (!productId && media) {
        const linkWithId = media.querySelector(
            'a[id*="StandardCardNoMediaLink"], a[id*="CardLink"], a[id*="NoMediaStandardLink"]'
        );
        if (linkWithId && linkWithId.id) {
            const match = linkWithId.id.match(/(\d+)$/);
            if (match) {
                productId = match[1];
            }
        }
    }

    // if null, undefined, empty string, or not a number -> return
    if (productId == null || isNaN(Number(productId))) {
        return null;
    }

    return productId
}

function findAllProductRoots() {
    const roots = new Set();

    // Find every product link
    const links = document.querySelectorAll(
        'a[href*="/products/"]:not([href*="#"])'
    );

    for (const link of links) {

        const root = findProductRoot(link);

        if (root) {
            roots.add(root);
        }
    }

    return [...roots];
}

function findProductRoot(link) {

    let node = link;
    let candidate = null;

    while (node && node !== document.body) {

        // Does this ancestor contain an image?
        const hasImage =
            node.querySelector("img, picture, video");

        if (
            hasImage &&
            containsOnlyOneProduct(node)
        ) {
            candidate = node;
        } else {
            // Once another product appears,
            // the previous candidate is our product root.
            if (candidate) {
                break;
            }
        }

        node = node.parentElement;
    }

    return candidate;
}

function containsOnlyOneProduct(node) {
    const links = node.querySelectorAll('a[href*="/products/"]');

    if (!links.length) return false;

    const handles = new Set();

    for (const link of links) {
        const handle = getHandleFromHref(link.getAttribute("href"));

        if (handle) {
            handles.add(handle);
        }
    }

    return handles.size === 1;
}

function getHandleFromHref(href) {
    if (!href) return null;

    const match = href.match(/\/products\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

function findProductHandle(root) {
    if (!root) return null;

    const link = root.querySelector('a[href*="/products/"]');

    if (!link) return null;

    return getHandleFromHref(link.getAttribute("href"));
}

function getHandleFromHref(href) {
    if (!href) return null;

    const match = href.match(/\/products\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

async function mainFunctionBadges() {

    const productRoots = findAllProductRoots();

    if (!productRoots.length) return;

    const rootMap = [];
    const productIds = [];
    const productHandles = [];

    for (const root of productRoots) {
        const productId = await findProductIdFromMedia(root);
        const handle = findProductHandle(root);

        rootMap.push({
            root,
            productId,
            handle
        });

        if (productId) {
            productIds.push(productId);
        }

        if (handle) {
            productHandles.push(handle);
        }
    }

    const uniqueIds = [...new Set(productIds)];

    const uniqueHandles = [...new Set(productHandles)];

    const badgeMap = await fetchBadgeForProducts(
        uniqueIds,
        uniqueHandles
    );

    for (const item of rootMap) {

        let badges = [];

        if (item.productId && badgeMap[item.productId]) {

            badges = badgeMap[item.productId];

        } else if (
            item.handle &&
            badgeMap[item.handle]
        ) {

            badges = badgeMap[item.handle];

        }

        if (!badges.length) {
            continue;
        }

        const pageBadges = badges.filter(label =>
            Array.isArray(label.showOnPages) &&
            label.showOnPages.includes("HOME_PAGE")
        );

        for (const badge of pageBadges) {
            renderBadgeUiOnProduct(badge, item.root);
        }
    }

    // let selectorFound = null;
    //
    // for (const sel of badgeHomeImageBelowSelectors) {
    //   const productMediaFound = document.querySelector(sel);
    //   if (productMediaFound) {
    //     selectorFound = sel;
    //     break;
    //   }
    // }
    //
    // if (!selectorFound) {
    //   console.warn("⚠️ No selector found in badgeHomeImageBelowSelectors");
    //   return;
    // }
    //
    // const productMedias = document.querySelectorAll(selectorFound);
    //
    // if (productMedias.length === 0) {
    //   console.warn("⚠️ No product media found for selector:", selectorFound);
    //   return;
    // }
    //
    // // 🔥 Step 1: Collect all productIds
    // const mediaProductMap = new Map(); // productId -> media
    // const productIds = [];
    //
    // for (const media of productMedias) {
    //   const productId = await findProductId(media);
    //
    //   if (!productId) continue;
    //
    //   productIds.push(productId);
    //
    //   if (!mediaProductMap.has(productId)) {
    //     mediaProductMap.set(productId, []);
    //   }
    //   mediaProductMap.get(productId).push(media);
    // }
    //
    // if (productIds.length === 0) {
    //   console.warn("⚠️ No valid productIds found");
    //   return;
    // }
    //
    // // 🔥 Step 2: Call ONE API
    // const badgeMap = await fetchBadgeByProductIds(productIds);
    //
    // if (!badgeMap || typeof badgeMap !== "object") {
    //   console.warn("⚠️ Invalid badgeMap response");
    //   return;
    // }

    // // 🔥 Step 3: Apply badges per product
    // for (const [productId, medias] of mediaProductMap.entries()) {
    //   const badgeList = badgeMap[productId];
    //
    //   if (!Array.isArray(badgeList) || badgeList.length === 0) {
    //     continue;
    //   }
    //
    //   for (const media of medias) {
    //     for (const badge of badgeList) {
    //       renderBadgeUiOnProduct(badge, media);
    //     }
    //   }
    // }

}

async function fetchBadgeForProducts(productIds, productHandles) {
    try {

        const res = await fetch(
            `http://localhost:8080/api/v1/testing/badge/app-embed/product-ids-or-handles`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI5MDgwNzQwMjc3MCIsInJvbGVzIjpbIlVTRVIiXSwidXNlcmlkIjoxLCJpYXQiOjE3ODE0OTY5MzJ9.sREm2SXqvm0_TmbexjR1Iddeh8OsagVe_9AlghHpfmw`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    productIds,
                    productHandles,
                    showOnPage: "HOME_PAGE"
                })
            }
        );

        if (!res.ok) {
            throw new Error("Fetch error");
        }

        return await res.json();

    } catch (err) {
        console.warn("fetchLabelForProducts error: ", err);
        return {};
    }

}

const loadedFonts = new Set();
const injectedAnimations = new Map();

function renderBadgeUiOnProduct(badge, media) {
    console.log("renderBadgeUiOnProduct, badge: ", badge)
    console.log("renderBadgeUiOnProduct, media: ", media)

    if (!badge || badge.status !== "ACTIVE") return;

    const position = badge.position || "BELOW_NAME";
    const font = badge.font || "Arial";

    // ✅ OPTIMIZED: Font load (no querySelector)
    if (font && !loadedFonts.has(font)) {
        const fontLink = document.createElement("link");
        fontLink.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, "+")}&display=swap`;
        fontLink.rel = "stylesheet";
        fontLink.setAttribute("data-font", font);
        document.head.appendChild(fontLink);
        loadedFonts.add(font);
    }

    const badgeContainer = document.createElement("div");
    badgeContainer.className = "asf-badge-container";

    badgeContainer.style.cssText = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: ${badge.gap || 4}px;
        padding: ${badge.padding || 4}px;
        background: ${badge.backgroundColor || "transparent"};
        border-radius: ${badge.border || 0}px;
        opacity: ${(badge.opacity || 100) / 100};
        font-family: '${font}', sans-serif;
        font-size: ${badge.fontSize || 14}px;
        color: ${badge.textColor || "#000"};
        margin-top: ${badge.marginTop || 0}px;
        margin-bottom: ${badge.marginBottom || 0}px;
        width: fit-content;
        height: fit-content;
      `;

    // --- IMG ---
    const img = badge.imageBadge
        ? (() => {
            const el = document.createElement("img");
            el.src = badge.imageBadge;
            el.alt = "badge";

            const w = badge.imageWidth || 24;
            const h = badge.imageHeight || 24;

            el.style.setProperty("width", w + "px", "important");
            el.style.setProperty("height", h + "px", "important");
            el.style.setProperty("max-width", "none", "important");
            el.style.setProperty("max-height", "none", "important");
            el.style.setProperty("display", "inline-block", "important");
            el.style.setProperty("flex", "0 0 auto", "important");
            el.style.setProperty("object-fit", "contain", "important");

            return el;
        })()
        : null;

    // --- TEXT ---
    const text = badge.content
        ? Object.assign(document.createElement("span"), {
            textContent: badge.content,
            style: `line-height: 1.2;`,
        })
        : null;

    if (badge.orderBadge === "ICON-TEXT") {
        if (img) badgeContainer.appendChild(img);
        if (text) badgeContainer.appendChild(text);
    } else {
        if (text) badgeContainer.appendChild(text);
        if (img) badgeContainer.appendChild(img);
    }

    // ✅ OPTIMIZED: Animation (reuse instead of inject every time)
    function injectBadgeAnimation(animationType, opacity) {
        const cacheKey = `${animationType}_${opacity}`;

        if (injectedAnimations.has(cacheKey)) {
            return injectedAnimations.get(cacheKey);
        }

        const uniqueKey = `asf_${animationType.toLowerCase()}_${injectedAnimations.size}`;
        let keyframes = "";

        switch (animationType) {
            case "FLASH":
                keyframes = `
            @keyframes ${uniqueKey} {
              0% { opacity: 0; }
              100% { opacity: ${opacity}; }
            }`;
                break;
            case "ZOOM_IN":
                keyframes = `
            @keyframes ${uniqueKey} {
              0% { transform: scale(0); opacity: ${opacity}; }
              100% { transform: scale(1); opacity: ${opacity}; }
            }`;
                break;
            case "ZOOM_OUT":
                keyframes = `
            @keyframes ${uniqueKey} {
              0% { transform: scale(1); opacity: ${opacity}; }
              100% { transform: scale(0); opacity: ${opacity}; }
            }`;
                break;
            case "SWING":
                keyframes = `
            @keyframes ${uniqueKey} {
              0% { transform: rotate(0deg); opacity: ${opacity}; }
              25% { transform: rotate(15deg); opacity: ${opacity}; }
              50% { transform: rotate(-15deg); opacity: ${opacity}; }
              100% { transform: rotate(0deg); opacity: ${opacity}; }
            }`;
                break;
            case "ROLL_IN":
                keyframes = `
            @keyframes ${uniqueKey} {
              0% { transform: translateX(-100%) rotate(-120deg); opacity: 0; }
              100% { transform: translateX(0) rotate(0deg); opacity: ${opacity}; }
            }`;
                break;
            case "ROLL_OUT":
                keyframes = `
            @keyframes ${uniqueKey} {
              0% { transform: translateX(0) rotate(0deg); opacity: ${opacity}; }
              100% { transform: translateX(100%) rotate(120deg); opacity: 0; }
            }`;
                break;
            default:
                return null;
        }

        const style = document.createElement("style");
        style.innerHTML = keyframes;
        document.head.appendChild(style);

        injectedAnimations.set(cacheKey, uniqueKey);
        return uniqueKey;
    }

    if (badge.animationType !== "NONE") {
        const opacity = badge.opacity ? badge.opacity / 100 : 1;
        const animKey = injectBadgeAnimation(badge.animationType, opacity);

        if (animKey) {
            const repeat = badge.repeatAnimation || "infinite";
            const duration = badge.duration || 1;

            badgeContainer.style.animation = `${animKey} ${duration}s ease-in-out ${repeat}`;
        }
    }

    // ✅ OPTIMIZED: cache parent once

    const tryInsertBelow = (selector) => {
        const componentFound = media.querySelector(selector);
        if (componentFound) {
            componentFound.insertAdjacentElement("afterend", badgeContainer);
        }
    };

    const tryInsertInlineWithPrice = (selector, position) => {
        const componentFound = media.querySelector(selector);
        if (componentFound) {
            const wrapper = document.createElement("span");
            wrapper.style.display = "inline-flex";
            wrapper.style.alignItems = "center";
            wrapper.style.gap = "6px";

            const clonedPrice = componentFound.cloneNode(true); // ✅ restore

            if (position === "BEFORE_PRICE") {
                wrapper.appendChild(badgeContainer);
                wrapper.appendChild(clonedPrice);
            } else {
                wrapper.appendChild(clonedPrice);
                wrapper.appendChild(badgeContainer);
            }

            componentFound.replaceWith(wrapper);
        } else {
            console.warn(`tryInsertInlineWithPrice ❌ No valid price element found for ${position}`);
        }
    };

    function insertBadgeBelowProductImage() {
        const componentFound = media.querySelector(badgeImageLayoutBelowHomePageSelectors);
        if (componentFound) {
            componentFound.insertAdjacentElement("afterend", badgeContainer);
        }
    }

    function isVisibleElement(el) {
        const style = window.getComputedStyle(el);
        if (
            style.display === 'none' ||
            style.visibility === 'hidden'
        ) {
            return false;
        }

        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function tryInsertBelowTitle() {
        let componentFound = null;

        // 1. Find by predefined selectors
        componentFound = media.querySelector(badgeTitleHomePageSelectors);
        if (componentFound) {
            console.log("tryInsertBelowTitle componentFound from badgeTitleHomePageSelectors: ", componentFound)
        }

        // 2. Find by class containing "title"
        if (!componentFound) {
            componentFound = Array.from(
                media.querySelectorAll('[class*="title" i]')
            ).find((el) => {
                const text = el.textContent?.trim();

                return (
                    text &&
                    text.length > 0 &&
                    isVisibleElement(el)
                );
            });
            if (componentFound) {
                console.log("tryInsertBelowTitle componentFound from class title: ", componentFound)
            }
        }

        // 3. Find by id containing "title"
        if (!componentFound) {
            componentFound = Array.from(
                media.querySelectorAll('[id*="title" i]')
            ).find((el) => {
                const text = el.textContent?.trim();

                return (
                    text &&
                    text.length > 0 &&
                    isVisibleElement(el)
                );
            });
            if (componentFound) {
                console.log("tryInsertBelowTitle componentFound from id title: ", componentFound)
            }
        }

        // 4. Find product <a href="/products/...">
        if (!componentFound) {
            componentFound = Array.from(
                media.querySelectorAll('a[href*="/products/"]')
            ).find((el) => {
                const text = el.textContent?.trim();

                return (
                    text &&
                    text.length > 0 &&
                    !el.querySelector('img') &&
                    isVisibleElement(el)
                );
            });
            if (componentFound) {
                console.log("tryInsertBelowTitle componentFound from a href: ", componentFound)
            }
        }

        // Insert badge
        if (componentFound) {
            componentFound.insertAdjacentElement(
                "afterend",
                badgeContainer
            );
        }
    }

    switch (position) {
        case "BELOW_NAME":
            tryInsertBelowTitle();
            break;
        case "BEFORE_PRICE":
            tryInsertInlineWithPrice(badgeBeforeAfterPriceHomePageSelectors, "BEFORE_PRICE");
            break;
        case "AFTER_PRICE":
            tryInsertInlineWithPrice(badgeBeforeAfterPriceHomePageSelectors, "AFTER_PRICE");
            break;
        case "BELOW_PRICE":
            tryInsertBelow(badgeBelowPriceHomePageSelectors);
            break;
        case "BELOW_PRODUCT_IMAGE":
            insertBadgeBelowProductImage();
            break;
        default:
            break;
    }
}

mainFunctionBadges();