// label - product page - find image of product
mainImageSelectors = [
    "li .product-media222",//Horizon
    "li .product__media333"
]

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

async function fetchLabelDetailOnMainProductPage() {
    try {
        const response = await fetch(`http://localhost:8080/api/v1/testing/label/app-embed/image/get-active-by-product`, {
            method: "POST", // Use POST because there's a request body
            headers: {
                "Authorization": `Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI5MDgwNzQwMjc3MCIsInJvbGVzIjpbIlVTRVIiXSwidXNlcmlkIjoxLCJpYXQiOjE3ODE0OTY5MzJ9.sREm2SXqvm0_TmbexjR1Iddeh8OsagVe_9AlghHpfmw`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                productId: 9865131426066
            })
        })

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const responseText = await response.text();
        if (!responseText) {
            throw new Error("Empty response body");
        }

        let labelList = [];
        try {
            labelList = JSON.parse(responseText);
        } catch (e) {
            console.error("Failed to parse JSON response:", e);
            return;
        }

        // Check that it's an array
        if (!Array.isArray(labelList)) {
            console.warn("Expected an array of label data");
            return;
        }

        // Filter for labels with PRODUCT_PAGE in showOnPages
        const productPageLabels = labelList.filter(label =>
            Array.isArray(label.showOnPages) && label.showOnPages.includes("PRODUCT_PAGE")
        );

        if (productPageLabels.length === 0) {
            return;
        }

        const imageContainers = getAllProductImageContainers()

        for (const label of productPageLabels) {

            if (label && label.type === "IMAGE" && label.iconUrl) {
                for (const container of imageContainers) {
                    renderLabelImageOnMainProductPage(label, container)
                }
            }

            if (label && label.type === "TEXT" && label.content) {
                for (const container of imageContainers) {
                    renderLabelTextOnMainProductPage(label, container);
                }
            }

        }

    } catch (error) {
        console.error("fetchLabelDetailProductPage ERROR:", error.message);
    }
}

function findFirstAcceptedProductImage() {

    const form =
        document.querySelector('form[action*="/cart/add"]') ||
        document.querySelector("product-form");

    if (!form) {
        return null;
    }

    let current = form;

    while (current && current !== document.body) {

        const image = findFirstAcceptedImage(current);

        if (image) {

            return image;
        }

        current = current.parentElement;
    }

    return null;
}

function findFirstAcceptedImage(root) {

    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT,
        {
            acceptNode(node) {

                if (node.tagName !== "IMG") {
                    return NodeFilter.FILTER_SKIP;
                }

                return isPossibleProductImage(node)
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_SKIP;
            }
        }
    );

    return walker.nextNode();
}

function findGalleryRoot(firstImage) {

    let node = firstImage.parentElement;

    while (node && node !== document.body) {

        const acceptedImages = Array
            .from(node.querySelectorAll("img"))
            .filter(isPossibleProductImage);

        // Even if there is only one product image,
        // this ancestor is still valid.
        if (acceptedImages.includes(firstImage)) {

            // Prefer the first ancestor that contains
            // more than one accepted image.
            if (acceptedImages.length > 1) {
                return node;
            }

            // Otherwise remember it as fallback.
            if (!node.__singleImageCandidate) {
                node.__singleImageCandidate = true;
            }
        }

        node = node.parentElement;
    }

    // Walk again to return the remembered single-image ancestor.
    node = firstImage.parentElement;

    while (node && node !== document.body) {

        if (node.__singleImageCandidate) {
            delete node.__singleImageCandidate;
            return node;
        }

        node = node.parentElement;
    }

    return null;
}

function isPossibleProductImage(img) {

    if (!img)
        return false;

    //------------------------------------
    // Ignore hidden
    //------------------------------------

    const rect = img.getBoundingClientRect();

    if (rect.width < 150 || rect.height < 150)
        return false;

    //------------------------------------
    // Ignore description
    //------------------------------------

    if (
        img.closest(".rte") ||
        img.closest(".product-description") ||
        img.closest(".description") ||
        img.closest(".accordion") ||
        img.closest(".tabs") ||
        img.closest("article") ||
        img.closest("footer") ||
        img.closest("header")
    ) {
        return false;
    }

    //------------------------------------
    // Ignore logo
    //------------------------------------

    if (
        img.closest(".logo") ||
        img.closest(".site-header") ||
        img.closest(".header") ||
        img.closest(".announcement-bar")
    ) {
        return false;
    }

    //------------------------------------
    // Ignore lazy placeholder
    //------------------------------------

    if (
        img.src.startsWith("data:") ||
        img.src.includes("placeholder")
    ) {
        return false;
    }

    return true;

}

function getMediaContainersFromRoot(galleryRoot) {

    const result = [];

    const images = [...galleryRoot.querySelectorAll("img")]
        .filter(isPossibleProductImage);

    for (const img of images) {

        // climb until this node contains ONLY this image
        let media = img.parentElement;

        while (media && media !== galleryRoot) {

            const acceptedImages = [...media.querySelectorAll("img")]
                .filter(isPossibleProductImage);

            if (acceptedImages.length === 1 &&
                acceptedImages[0] === img) {
                break;
            }

            media = media.parentElement;
        }

        if (media && !result.includes(media)) {
            result.push(media);
        }
    }

    return result;
}

function getAllProductImageContainers() {
    // Priority 1: known selectors
    for (const selector of mainImageSelectors) {

        const medias = document.querySelectorAll(selector);

        if (medias.length) {

            return [...medias]
                .map(m => m.querySelector("img")?.parentElement)
                .filter(Boolean);
        }
    }

    // Priority 2: generic detection
    const firstImage = findFirstAcceptedProductImage();

    if (!firstImage) {
        console.warn("Cannot find first product image.");
        return [];
    }

    const root = findGalleryRoot(firstImage);

    if (!root) {
        console.warn("Cannot find gallery root.");
        return [];
    }

    return getMediaContainersFromRoot(root);
}

// 🔥 cache keyframes (add this OUTSIDE function, only once)
const asfAnimationCacheTest = new Set();

function renderLabelImageOnMainProductPage(data, imgContainer) {
    const rect = imgContainer.getBoundingClientRect();
    // Ignore small containers (icons, thumbnails, logos, etc.)
    if (rect.width < 150 || rect.height < 150) {
        return;
    }

    imgContainer.style.position = "relative";
    imgContainer.style.overflow = "visible";

    // 🚫 Prevent duplicate label
    if (imgContainer.querySelector(`.asf-label-overlay[data-label-id="${data.id}"]`)) {
        return;
    }

    const labelImg = document.createElement("img");
    labelImg.src = data.iconUrl;
    labelImg.className = "asf-label-overlay";
    labelImg.setAttribute("data-label-id", data.id);

    const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
    const labelWidth = isMobile ? data.widthMobile : data.width;
    const labelHeight = isMobile ? data.heightMobile : data.height;

    Object.assign(labelImg.style, {
        position: "absolute",
        width: `${labelWidth}px`,
        height: `${labelHeight}px`,
        opacity: data.opacity / 100,
        zIndex: 999,
        pointerEvents: "none",
        top: "auto",
        left: "auto",
        right: "auto",
        bottom: "auto",
        transform: "",
        backgroundColor: "transparent"
    });

    // ✅ Reset margins
    labelImg.style.marginTop = "";
    labelImg.style.marginRight = "";
    labelImg.style.marginBottom = "";
    labelImg.style.marginLeft = "";

    const margin = data.margin || 0;
    const position = data.iconPosition || "";

    // ✅ Apply margin
    switch (position) {
        case "TOP_LEFT":
            labelImg.style.marginTop = margin + "px";
            labelImg.style.marginLeft = margin + "px";
            break;

        case "TOP_CENTER":
            labelImg.style.marginTop = margin + "px";
            break;

        case "TOP_RIGHT":
            labelImg.style.marginTop = margin + "px";
            labelImg.style.marginRight = margin + "px";
            break;

        case "CENTER_LEFT":
            labelImg.style.marginLeft = margin + "px";
            break;

        case "CENTER":
            break;

        case "CENTER_RIGHT":
            labelImg.style.marginRight = margin + "px";
            break;

        case "BOTTOM_LEFT":
            labelImg.style.marginBottom = margin + "px";
            labelImg.style.marginLeft = margin + "px";
            break;

        case "BOTTOM_CENTER":
            labelImg.style.marginBottom = margin + "px";
            break;

        case "BOTTOM_RIGHT":
            labelImg.style.marginBottom = margin + "px";
            labelImg.style.marginRight = margin + "px";
            break;
    }

    // ✅ Position
    const pos = data.iconPosition;
    if (pos === "TOP_LEFT") {
        labelImg.style.top = "0";
        labelImg.style.left = "0";
    } else if (pos === "TOP_CENTER") {
        labelImg.style.top = "0";
        labelImg.style.left = "50%";
        labelImg.style.transform = "translateX(-50%)";
    } else if (pos === "TOP_RIGHT") {
        labelImg.style.top = "0";
        labelImg.style.right = "0";
    } else if (pos === "CENTER_LEFT") {
        labelImg.style.top = "50%";
        labelImg.style.left = "0";
        labelImg.style.transform = "translateY(-50%)";
    } else if (pos === "CENTER") {
        labelImg.style.top = "50%";
        labelImg.style.left = "50%";
        labelImg.style.transform = "translate(-50%, -50%)";
    } else if (pos === "CENTER_RIGHT") {
        labelImg.style.top = "50%";
        labelImg.style.right = "0";
        labelImg.style.transform = "translateY(-50%)";
    } else if (pos === "BOTTOM_LEFT") {
        labelImg.style.bottom = "0";
        labelImg.style.left = "0";
    } else if (pos === "BOTTOM_CENTER") {
        labelImg.style.bottom = "0";
        labelImg.style.left = "50%";
        labelImg.style.transform = "translateX(-50%)";
    } else if (pos === "BOTTOM_RIGHT") {
        labelImg.style.bottom = "0";
        labelImg.style.right = "0";
    } else {
        labelImg.style.top = "0";
        labelImg.style.left = "0";
    }

    // === Animation logic (kept, only optimized) ===
    const animation = data.animationType;
    const duration = data.duration || 1;
    const repeat = data.repeatAnimation || "infinite";
    const opacity = data.opacity / 100;

    if (animation && animation !== "NONE") {
        const transformPrefix = labelImg.style.transform || "";
        const animationName = `asf_${animation}_${data.id}`;

        if (!asfAnimationCache.has(animationName)) {
            const keyframes = document.createElement("style");
            keyframes.type = "text/css";
            let keyframeCSS = "";

            switch (animation) {
                case "FLASH":
                    keyframeCSS = `
              @keyframes ${animationName} {
                0% { opacity: 0; }
                100% { opacity: ${opacity}; }
              }
            `;
                    break;

                case "ZOOM_IN":
                    keyframeCSS = `
              @keyframes ${animationName} {
                0% {
                  transform: ${transformPrefix} scale(0);
                  opacity: ${opacity};
                }
                100% {
                  transform: ${transformPrefix} scale(1);
                  opacity: ${opacity};
                }
              }
            `;
                    break;

                case "ZOOM_OUT":
                    keyframeCSS = `
              @keyframes ${animationName} {
                0% {
                  transform: ${transformPrefix} scale(1);
                  opacity: ${opacity};
                }
                100% {
                  transform: ${transformPrefix} scale(0);
                  opacity: ${opacity};
                }
              }
            `;
                    break;

                case "SWING":
                    keyframeCSS = `
              @keyframes ${animationName} {
                0% { transform: ${transformPrefix} rotate(0deg); opacity: ${opacity}; }
                25% { transform: ${transformPrefix} rotate(15deg); opacity: ${opacity}; }
                50% { transform: ${transformPrefix} rotate(-15deg); opacity: ${opacity}; }
                100% { transform: ${transformPrefix} rotate(0deg); opacity: ${opacity}; }
              }
            `;
                    break;

                case "ROLL_IN":
                    keyframeCSS = `
              @keyframes ${animationName} {
                0% {
                  transform: ${transformPrefix} translateX(-100%) rotate(-120deg);
                  opacity: 0;
                }
                100% {
                  transform: ${transformPrefix} translateX(0) rotate(0deg);
                  opacity: ${opacity};
                }
              }
            `;
                    break;

                case "ROLL_OUT":
                    keyframeCSS = `
              @keyframes ${animationName} {
                0% {
                  transform: ${transformPrefix} translateX(0) rotate(0deg);
                  opacity: ${opacity};
                }
                100% {
                  transform: ${transformPrefix} translateX(100%) rotate(120deg);
                  opacity: 0;
                }
              }
            `;
                    break;
            }

            if (keyframeCSS) {
                keyframes.innerHTML = keyframeCSS;
                document.head.appendChild(keyframes);
                asfAnimationCache.add(animationName);
            }
        }

        Object.assign(labelImg.style, {
            animation: `${animationName} ${duration}s ${repeat}`,
        });
    }

    imgContainer.appendChild(labelImg);
}

// 🔥 GLOBAL CACHE (add once outside)
const asfTextAnimationCacheTest = new Set();
const asfFontCacheTest = new Set();

function renderLabelTextOnMainProductPage(data, imgContainer) {
    if (getComputedStyle(imgContainer).position === "static") {
        imgContainer.style.position = "relative";
    }

    // 🚫 Prevent duplicate label
    if (imgContainer.querySelector(`.asf-label-text[data-label-id="${data.id}"]`)) {
        return;
    }

    const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
    const widthSVG = isMobile ? data.widthMobile : data.width;
    const heightSVG = isMobile ? data.heightMobile : data.height;

    const productRect = imgContainer.getBoundingClientRect();
    const imageWidth = productRect.width;
    const imageHeight = productRect.height;

    // Ignore small containers (icons, thumbnails, logos, etc.)
    if (imageWidth < 150 || imageHeight < 150) {
        return;
    }

    const offsetLeft = imageWidth * (data.marginLeft / 100) - widthSVG * (data.marginLeft / 100);
    const offsetTop = imageHeight * (data.marginTop / 100) - heightSVG * (data.marginTop / 100);

    const container = document.createElement("div");
    container.style.width = `${widthSVG}px`;
    container.style.height = `${heightSVG}px`;
    container.style.position = "absolute";
    container.style.top = "0";
    container.style.left = "0";
    container.style.borderRadius = `${data.borderRadius}px`;
    container.style.overflow = "hidden";
    container.style.pointerEvents = "none";
    container.style.background = "transparent";
    container.style.zIndex = "1";

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", widthSVG);
    svg.setAttribute("height", heightSVG);
    svg.setAttribute("xmlns", svgNS);
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", `0 0 ${widthSVG} ${heightSVG}`);
    svg.style.overflow = "visible";
    svg.style.transform = "";
    svg.style.transformOrigin = "center";

    function drawCircle() {
        const r = Math.min(widthSVG, heightSVG) / 2;
        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute("cx", widthSVG / 2);
        circle.setAttribute("cy", heightSVG / 2);
        circle.setAttribute("r", r);
        circle.setAttribute("fill", data.backgroundColor);
        svg.appendChild(circle);
    }

    function drawRect() {
        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", 0);
        rect.setAttribute("y", 0);
        rect.setAttribute("width", widthSVG);
        rect.setAttribute("height", heightSVG);
        rect.setAttribute("fill", data.backgroundColor);
        rect.setAttribute("rx", data.borderRadius);
        rect.setAttribute("ry", data.borderRadius);
        svg.appendChild(rect);
    }

    function drawPolygon(points) {
        const polygon = document.createElementNS(svgNS, "polygon");
        polygon.setAttribute("points", points);
        polygon.setAttribute("fill", data.backgroundColor);
        svg.appendChild(polygon);
    }

    // 🔥 optimized font loader
    function loadGoogleFontIfNeeded(fontName) {
        if (!fontName) return;

        const fontSlug = fontName.replace(/ /g, "+");
        const fontUrl = `https://fonts.googleapis.com/css2?family=${fontSlug}&display=swap`;

        if (!asfFontCache.has(fontUrl)) {
            const link = document.createElement("link");
            link.href = fontUrl;
            link.rel = "stylesheet";
            document.head.appendChild(link);

            asfFontCache.add(fontUrl);
        }
    }

    function addText(x, y, rotate = 0) {
        loadGoogleFontIfNeeded(data.font);

        const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

        const fontSizeForText = isMobile
            ? (data.fontSizeMobile != null && data.fontSizeMobile !== ""
                ? data.fontSizeMobile
                : data.fontSize / 2)
            : data.fontSize;

        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", x);
        text.setAttribute("y", y);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.setAttribute("font-size", fontSizeForText);
        text.setAttribute("fill", data.textColor);
        text.setAttribute("font-family", data.font);

        if (rotate !== 0) {
            text.setAttribute("transform", `rotate(${rotate} ${x} ${y})`);
        }

        text.textContent = data.content;
        svg.appendChild(text);
    }

    // === Draw background ===
    switch (data.background) {
        case "SVG_CIRCLE":
            drawCircle();
            addText(widthSVG / 2, heightSVG / 2);
            break;
        case "SVG_SQUARE":
            drawRect();
            addText(widthSVG / 2, widthSVG / 2);
            break;
        case "SVG_RECTANGLE":
            drawRect();
            addText(widthSVG / 2, heightSVG / 2);
            break;
        case "SVG_TRIANGLE_TOP_LEFT":
            drawPolygon(`0,0 ${widthSVG},0 0,${heightSVG}`);
            addText(widthSVG * 0.4, heightSVG * 0.4, 315);
            break;
        case "SVG_TRIANGLE_TOP_RIGHT":
            drawPolygon(`0,0 ${widthSVG},0 ${widthSVG},${heightSVG}`);
            addText(widthSVG * 0.6, heightSVG * 0.4, 45);
            break;
        case "SVG_TRIANGLE_BOTTOM_LEFT":
            drawPolygon(`0,0 ${widthSVG},${widthSVG} 0,${heightSVG}`);
            addText(widthSVG * 0.35, heightSVG * 0.6, 45);
            break;
        case "SVG_TRIANGLE_BOTTOM_RIGHT":
            drawPolygon(`0,${widthSVG} ${widthSVG},${widthSVG} ${widthSVG},0`);
            addText(widthSVG * 0.65, heightSVG * 0.65, 315);
            break;
        case "SVG_RIBBON_TOP_LEFT":
            drawPolygon(`${widthSVG / 2},0 ${widthSVG},0 0,${heightSVG} 0,${heightSVG / 2}`);
            addText(widthSVG * 0.38, widthSVG * 0.38, -45);
            break;
        case "SVG_RIBBON_TOP_RIGHT":
            drawPolygon(`0,0 ${widthSVG / 2},0 ${widthSVG},${widthSVG / 2} ${widthSVG},${widthSVG}`);
            addText(widthSVG * 0.65, heightSVG * 0.4, 45);
            break;
        case "SVG_RIBBON_BOTTOM_LEFT":
            drawPolygon(`0,0 0,${widthSVG / 2} ${widthSVG / 2},${widthSVG} ${widthSVG},${widthSVG}`);
            addText(widthSVG * 0.35, heightSVG * 0.6, 45);
            break;
        case "SVG_RIBBON_BOTTOM_RIGHT":
            drawPolygon(`0,${widthSVG} ${widthSVG / 2},${widthSVG} ${widthSVG},${widthSVG / 2} ${widthSVG},0`);
            addText(widthSVG * 0.6, widthSVG * 0.65, -45);
            break;
        case "SVG_GIM_LEFT":
            drawPolygon(`30,0 ${widthSVG},0 ${widthSVG},${heightSVG} 30,${heightSVG} 0,${heightSVG / 2}`);
            addText(widthSVG / 2 + 10, heightSVG / 2);
            break;
        case "SVG_GIM_RIGHT":
            drawPolygon(`0,0 ${widthSVG - 30},0 ${widthSVG},${heightSVG / 2} ${widthSVG - 30},${heightSVG} 0,${heightSVG}`);
            addText(widthSVG / 2 - 5, heightSVG / 2);
            break;
        case "SVG_INCISOR_LEFT":
            drawPolygon(`0,0 ${widthSVG},0 ${widthSVG},${heightSVG} 0,${heightSVG} 30,${heightSVG / 2}`);
            addText(widthSVG / 2 + 10, heightSVG / 2);
            break;
        case "SVG_INCISOR_RIGHT":
            drawPolygon(`0,0 ${widthSVG},0 ${widthSVG - 30},${heightSVG / 2} ${widthSVG},${heightSVG} 0,${heightSVG}`);
            addText(widthSVG / 2 - 10, heightSVG / 2);
            break;
        default:
            drawRect();
            addText(widthSVG / 2, heightSVG / 2);
            break;
    }

    container.appendChild(svg);

    const outer = document.createElement("div");
    outer.className = "asf-label-text";
    outer.setAttribute("data-label-id", data.id);

    outer.style.position = "absolute";
    outer.style.top = `${offsetTop}px`;
    outer.style.left = `${offsetLeft}px`;
    outer.style.width = `${widthSVG}px`;
    outer.style.height = `${heightSVG}px`;
    outer.style.zIndex = "99";
    outer.style.pointerEvents = "none";
    outer.style.filter = `drop-shadow(${data.shadowX}px ${data.shadowY}px ${data.blur}px ${data.blurColor})`;
    outer.style.overflow = "visible";
    outer.style.opacity = data.opacity / 100;

    // === Animation (optimized) ===
    if (data.animationType !== "NONE") {
        const opacity = data.opacity / 100;
        const animationName = `asf_text_${data.animationType}_${data.id}`;

        if (!asfTextAnimationCache.has(animationName)) {
            let keyframes = "";

            switch (data.animationType) {
                case "FLASH":
                    keyframes = `
              @keyframes ${animationName} {
                0% { opacity: 0; }
                100% { opacity: ${opacity}; }
              }`;
                    break;
                case "ZOOM_IN":
                    keyframes = `
              @keyframes ${animationName} {
                0% { transform: scale(0); opacity: ${opacity}; }
                100% { transform: scale(1); opacity: ${opacity}; }
              }`;
                    break;
                case "ZOOM_OUT":
                    keyframes = `
              @keyframes ${animationName} {
                0% { transform: scale(1); opacity: ${opacity}; }
                100% { transform: scale(0); opacity: ${opacity}; }
              }`;
                    break;
                case "SWING":
                    keyframes = `
              @keyframes ${animationName} {
                0% { transform: rotate(0deg); opacity: ${opacity}; }
                25% { transform: rotate(15deg); opacity: ${opacity}; }
                50% { transform: rotate(-15deg); opacity: ${opacity}; }
                100% { transform: rotate(0deg); opacity: ${opacity}; }
              }`;
                    break;
                case "ROLL_IN":
                    keyframes = `
              @keyframes ${animationName} {
                0% { transform: translateX(-100%) rotate(-120deg); opacity: 0; }
                100% { transform: translateX(0) rotate(0deg); opacity: ${opacity}; }
              }`;
                    break;
                case "ROLL_OUT":
                    keyframes = `
              @keyframes ${animationName} {
                0% { transform: translateX(0) rotate(0deg); opacity: ${opacity}; }
                100% { transform: translateX(100%) rotate(120deg); opacity: 0; }
              }`;
                    break;
            }

            if (keyframes) {
                const styleSheet = document.createElement("style");
                styleSheet.innerHTML = keyframes;
                document.head.appendChild(styleSheet);
                asfTextAnimationCache.add(animationName);
            }
        }

        outer.style.animation = `${animationName} ${data.duration}s ${data.repeatAnimation}`;
    }

    outer.appendChild(container);
    imgContainer.appendChild(outer);
}

fetchLabelDetailOnMainProductPage();