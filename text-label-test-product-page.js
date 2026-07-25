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
        const response = await fetch(`http://localhost:8080/api/v1/testing/label/app-embed/text/get-active-by-product`, {
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

        const productContainer = findMainProductContainer();

        const gallery = findGalleryContainer(productContainer);

        if (!gallery) return;

        const images = gallery.querySelectorAll("img");

        console.log("fetchLabelDetailOnMainProductPage, images: ", images)

        for (const label of productPageLabels) {

            if (label && label.type === "IMAGE" && label.iconUrl) {
                for (const img of images) {
                    const productMedia = img.parentElement
                    renderLabelImageOnMainProductPage(label, productMedia)
                }
            }

            if (label && label.type === "TEXT" && label.content) {
                for (const img of images) {
                    const productMedia = img.parentElement
                    renderLabelTextOnMainProductPage(label, productMedia);
                }
            }

        }

    } catch (error) {
        console.error("fetchLabelDetailProductPage ERROR:", error.message);
    }
}

// 🔥 cache keyframes (add this OUTSIDE function, only once)
const asfAnimationCacheTest = new Set();

function findGalleryContainer(productContainer) {
    if (!productContainer) return null;

    let best = null;
    let maxImages = 0;

    const walker = document.createTreeWalker(
        productContainer,
        NodeFilter.SHOW_ELEMENT
    );

    while (walker.nextNode()) {

        const el = walker.currentNode;

        const imgs = el.querySelectorAll("img");

        if (imgs.length > maxImages) {
            maxImages = imgs.length;
            best = el;
        }
    }
    console.log("findGalleryContainer, container: ", best)
    return best;
}

function findMainProductContainer() {

    const form =
        document.querySelector('form[action*="/cart/add"]') ||
        document.querySelector("product-form");

    if (!form) return null;

    let node = form;

    while (node && node !== document.body) {

        const images = [...node.querySelectorAll("img")]
            .filter(isRealProductImage);

        // Found the first ancestor containing real product images
        if (images.length) {
            console.log("findMainProductContainer, node: ", node)
            return node;
        }

        node = node.parentElement;
    }

    return null;
}

// function findMainProductContainer() {
//     const form =
//         document.querySelector('form[action*="/cart/add"]') ||
//         document.querySelector("product-form");
//
//     if (!form) return null;
//
//     let node = form;
//     let candidate = null;
//
//     while (node && node !== document.body) {
//
//         const images = [...node.querySelectorAll("img")]
//             .filter(isRealProductImage);
//
//         if (images.length > 0) {
//             candidate = node;
//         }
//
//         node = node.parentElement;
//     }
//     console.log("findMainProductContainer, candidate: ", candidate)
//     return candidate;
// }

function isRealProductImage(img) {
    if (!(img instanceof HTMLImageElement)) {
        return false;
    }

    // Ignore hidden images
    if (img.offsetParent === null) {
        return false;
    }

    // Rendered size
    const rect = img.getBoundingClientRect();
    console.log("isRealProductImage, getBoundingClientRect, rect width height: ", rect.width, rect.height)

    if (rect.width < 80 || rect.height < 80) {
        console.log("isRealProductImage, rect.width < 80 || rect.height < 80 return false")
        return false;
    }

    console.log("isRealProductImage, getBoundingClientRect, img.complete: ", img.complete)
    console.log("isRealProductImage, getBoundingClientRect, naturalWidth width height: ", rect.naturalWidth, rect.naturalHeight)

    // Natural image size (after loaded)
    return !(img.complete &&
        (img.naturalWidth < 150 || img.naturalHeight < 150));

}

function renderLabelImageOnMainProductPage(data, productMedia) {
    const container = productMedia.querySelector("img")?.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    console.log("renderLabelTextOnMainProductPage, container add label image rect.width: ", rect.width);
    console.log("renderLabelTextOnMainProductPage, container add label image rect.height: ", rect.height);
    // Ignore small containers (icons, thumbnails, logos, etc.)
    if (rect.width < 150 || rect.height < 150) {
        return;
    }

    container.style.position = "relative";
    container.style.overflow = "visible";

    // 🚫 Prevent duplicate label
    if (container.querySelector(`.asf-label-overlay[data-label-image-id="${data.id}"]`)) {
        return;
    }

    const labelImg = document.createElement("img");
    labelImg.src = data.iconUrl;
    labelImg.className = "asf-label-overlay";
    labelImg.setAttribute("data-label-image-id", data.id);

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

        if (!asfAnimationCacheTest.has(animationName)) {
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
                asfAnimationCacheTest.add(animationName);
            }
        }

        Object.assign(labelImg.style, {
            animation: `${animationName} ${duration}s ${repeat}`,
        });
    }

    container.appendChild(labelImg);
}

// 🔥 GLOBAL CACHE (add once outside)
const asfTextAnimationCacheTest = new Set();
const asfFontCacheTest = new Set();

function renderLabelTextOnMainProductPage(data, productMedia) {
    if (getComputedStyle(productMedia).position === "static") {
        productMedia.style.position = "relative";
    }

    // 🚫 Prevent duplicate label
    if (productMedia.querySelector(`.asf-label-text[data-label-text-id="${data.id}"]`)) {
        return;
    }

    const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
    const widthSVG = isMobile ? data.widthMobile : data.width;
    const heightSVG = isMobile ? data.heightMobile : data.height;

    const productRect = productMedia.getBoundingClientRect();
    const imageWidth = productRect.width;
    const imageHeight = productRect.height;

    console.log("renderLabelTextOnMainProductPage, container add label text imageWidth: ", imageWidth);
    console.log("renderLabelTextOnMainProductPage, container add label text imageHeight: ", imageHeight);
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

        if (!asfFontCacheTest.has(fontUrl)) {
            const link = document.createElement("link");
            link.href = fontUrl;
            link.rel = "stylesheet";
            document.head.appendChild(link);

            asfFontCacheTest.add(fontUrl);
        }
    }

    function addText(x, y, rotate = 0) {
        loadGoogleFontIfNeeded(data.font);

        const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
        const fontSizeForText = isMobile ? data.fontSizeMobile : data.fontSize;

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
    outer.setAttribute("data-label-text-id", data.id);

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

        if (!asfTextAnimationCacheTest.has(animationName)) {
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
                asfTextAnimationCacheTest.add(animationName);
            }
        }

        outer.style.animation = `${animationName} ${data.duration}s ${data.repeatAnimation}`;
    }

    outer.appendChild(container);
    productMedia.appendChild(outer);
}

fetchLabelDetailOnMainProductPage();


async function fetchLabelForProducts(productIds, productHandles) {
    try {

        const res = await fetch(
            `http://localhost:8080/api/v1/testing/label/app-embed/text/product-ids-or-handles`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI5MDgwNzQwMjc3MCIsInJvbGVzIjpbIlVTRVIiXSwidXNlcmlkIjoxLCJpYXQiOjE3ODE0OTY5MzJ9.sREm2SXqvm0_TmbexjR1Iddeh8OsagVe_9AlghHpfmw`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    productIds,
                    productHandles,
                    showOnPage: "PRODUCT_PAGE"
                })
            }
        );

        if (!res.ok) {
            throw new Error("Fetch error");
        }

        const response = await res.json();
        console.log("fetchLabelForProducts, response: ", response)

        return response;

    } catch (err) {
        console.warn("fetchLabelForProducts error: ", err);
        return {};
    }

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

const processedRoots = new WeakSet();

async function mainFunctionLabels() {
    console.log("---------- list product, mainFunctionLabels start ----------");

    const allRoots = findAllProductRoots();

    // Only process new roots
    const productRoots = allRoots.filter(root => !processedRoots.has(root));

    if (!productRoots.length) {
        return;
    }

    console.log("New productRoots:", productRoots);

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

    const labelMap = await fetchLabelForProducts(
        uniqueIds,
        uniqueHandles
    );

    console.log("labelMap:", labelMap);

    for (const item of rootMap) {

        let labels = [];

        if (item.productId && labelMap[item.productId]) {
            labels = labelMap[item.productId];
        } else if (item.handle && labelMap[item.handle]) {
            labels = labelMap[item.handle];
        }

        const pageLabels = labels.filter(label =>
            Array.isArray(label.showOnPages) &&
            label.showOnPages.includes("PRODUCT_PAGE")
        );

        for (const label of pageLabels) {

            if (label.type === "IMAGE" && label.iconUrl) {
                updateLabelImageOnPage(label, item.root);
            }

            if (label.type === "TEXT" && label.content) {
                updateLabelTextOnPage(label, item.root);
            }
        }

        // Mark processed AFTER rendering
        console.log("+++++++++++++++ processedRoots add item ++++++++++++++++: ", processedRoots);
        processedRoots.add(item.root);
    }
}

// ✅ GLOBAL CACHE (outside function)
const injectedAnimationsTest = new Set();

function ensureAnimationStyle(animationName, keyframeCSS) {
    if (injectedAnimationsTest.has(animationName)) return;

    const styleTag = document.createElement("style");
    styleTag.textContent = keyframeCSS;
    document.head.appendChild(styleTag);

    injectedAnimationsTest.add(animationName);
}

function updateLabelImageOnPage(data, cardMedia) {
    console.log(" ---------- list product, updateLabelImageOnPage, data: ", data)
    console.log(" ---------- list product, updateLabelImageOnPage, cardMedia: ", cardMedia)

    if (!data?.id || !data?.iconUrl || !cardMedia) return;

    if (!Array.isArray(data.showOnPages) || !data.showOnPages.includes("PRODUCT_PAGE")) return;

    const img = cardMedia.querySelector('img');
    const imageContainer = img ? img.parentElement : cardMedia;

    // ✅ prevent duplicate render
    if (imageContainer.querySelector(`[data-label-image-id="${data.id}"]`)) {
        return;
    }

    const labelImg = document.createElement("img");
    labelImg.src = data.iconUrl;
    labelImg.alt = data.name || "Label";

    labelImg.setAttribute("data-label-image", "true");
    labelImg.setAttribute("data-label-image-id", data.id);

    const opacity = data.opacity / 100;
    const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

    const labelWidth = isMobile ? data.widthMobile : data.width;
    const labelHeight = isMobile ? data.heightMobile : data.height;

    const margin = data.margin || 0;
    const position = data.iconPosition || "";

    let marginStyle = "";

    switch (position) {
        case "TOP_LEFT":
            marginStyle = `margin-top:${margin}px; margin-left:${margin}px;`;
            break;

        case "TOP_CENTER":
            marginStyle = `margin-top:${margin}px;`;
            break;

        case "TOP_RIGHT":
            marginStyle = `margin-top:${margin}px; margin-right:${margin}px;`;
            break;

        case "CENTER_LEFT":
            marginStyle = `margin-left:${margin}px;`;
            break;

        case "CENTER":
            marginStyle = ``;
            break;

        case "CENTER_RIGHT":
            marginStyle = `margin-right:${margin}px;`;
            break;

        case "BOTTOM_LEFT":
            marginStyle = `margin-bottom:${margin}px; margin-left:${margin}px;`;
            break;

        case "BOTTOM_CENTER":
            marginStyle = `margin-bottom:${margin}px;`;
            break;

        case "BOTTOM_RIGHT":
            marginStyle = `margin-bottom:${margin}px; margin-right:${margin}px;`;
            break;
    }

    // ✅ Use cssText (faster than Object.assign)
    labelImg.style.cssText = `
        position:absolute;
        width:${labelWidth}px;
        height:${labelHeight}px;
        opacity:${opacity};
        ${marginStyle}
        z-index:999;
        pointer-events:none;
      `;

    // === Position ===
    const pos = data.iconPosition;

    let transform = "";

    labelImg.style.top = "auto";
    labelImg.style.left = "auto";
    labelImg.style.right = "auto";
    labelImg.style.bottom = "auto";

    switch (pos) {
        case "TOP_LEFT":
            labelImg.style.top = "0";
            labelImg.style.left = "0";
            transform = "";
            break;

        case "TOP_CENTER":
            labelImg.style.top = "0";
            labelImg.style.left = "50%";
            transform = "translateX(-50%)";
            break;

        case "TOP_RIGHT":
            labelImg.style.top = "0";
            labelImg.style.right = "0";
            transform = "";
            break;

        case "CENTER_LEFT":
            labelImg.style.top = "50%";
            labelImg.style.left = "0";
            transform = "translateY(-50%)";
            break;

        case "CENTER":
            labelImg.style.top = "50%";
            labelImg.style.left = "50%";
            transform = "translate(-50%, -50%)";
            break;

        case "CENTER_RIGHT":
            labelImg.style.top = "50%";
            labelImg.style.right = "0";
            transform = "translateY(-50%)";
            break;

        case "BOTTOM_LEFT":
            labelImg.style.bottom = "0";
            labelImg.style.left = "0";
            transform = "";
            break;

        case "BOTTOM_CENTER":
            labelImg.style.bottom = "0";
            labelImg.style.left = "50%";
            transform = "translateX(-50%)";
            break;

        case "BOTTOM_RIGHT":
            labelImg.style.bottom = "0";
            labelImg.style.right = "0";
            transform = "";
            break;
    }

    if (transform) {
        labelImg.style.transform = transform;
    }

    // === Animation (OPTIMIZED) ===
    const animation = data.animationType;
    const duration = data.duration || 1;
    const repeat = data.repeatAnimation || "infinite";

    if (animation && animation !== "NONE") {
        let animationName = "";
        let keyframeCSS = "";

        switch (animation) {
            case "FLASH":
                animationName = "asfFlashRepeat";
                keyframeCSS = `@keyframes ${animationName} {
              0% { opacity: 0; }
              100% { opacity: ${opacity}; }
            }`;
                break;

            case "ZOOM_IN":
                animationName = "asfZoomInRepeat";
                keyframeCSS = `@keyframes ${animationName} {
              0% { transform: ${transform} scale(0); }
              100% { transform: ${transform} scale(1); }
            }`;
                break;

            case "ZOOM_OUT":
                animationName = "asfZoomOutRepeat";
                keyframeCSS = `@keyframes ${animationName} {
              0% { transform: ${transform} scale(1); }
              100% { transform: ${transform} scale(0); }
            }`;
                break;

            case "SWING":
                animationName = "asfSwingRepeat";
                keyframeCSS = `@keyframes ${animationName} {
              0% { transform: ${transform} rotate(0deg); }
              25% { transform: ${transform} rotate(15deg); }
              50% { transform: ${transform} rotate(-15deg); }
              100% { transform: ${transform} rotate(0deg); }
            }`;
                break;

            case "ROLL_IN":
                animationName = "asfRollInRepeat";
                keyframeCSS = `@keyframes ${animationName} {
              0% { transform: ${transform} translateX(-100%) rotate(-120deg); opacity: 0; }
              100% { transform: ${transform}; opacity: ${opacity}; }
            }`;
                break;

            case "ROLL_OUT":
                animationName = "asfRollOutRepeat";
                keyframeCSS = `@keyframes ${animationName} {
              0% { transform: ${transform}; opacity: ${opacity}; }
              100% { transform: ${transform} translateX(100%) rotate(120deg); opacity: 0; }
            }`;
                break;
        }

        if (animationName && keyframeCSS) {
            ensureAnimationStyle(animationName, keyframeCSS);

            labelImg.style.animation = `${animationName} ${duration}s ${repeat}`;
            labelImg.style.willChange = "transform, opacity"; // 🚀 GPU hint
        }
    }

    // ✅ Ensure parent is relative ONLY once
    if (getComputedStyle(imageContainer).position === "static") {
        imageContainer.style.position = "relative";
    }

    imageContainer.appendChild(labelImg);
}

const injectedTextAnimationsTest = new Set();
const loadedFontsTest = new Set();

function updateLabelTextOnPage(data, cardMedia) {
    if (!data || !data.id || !data.content) {
        console.warn("Invalid label data");
        return;
    }

    if (!Array.isArray(data.showOnPages) || !data.showOnPages.includes("PRODUCT_PAGE")) {
        return;
    }

    const img = cardMedia.querySelector('img');
    const imageContainer = img ? img.parentElement : cardMedia;

    // ✅ prevent duplicate render
    if (imageContainer.querySelector(`[data-label-text-id="${data.id}"]`)) {
        return;
    }

    const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
    const widthSVG = isMobile ? data.widthMobile : data.width;
    const heightSVG = isMobile ? data.heightMobile : data.height;

    const productRect = imageContainer.getBoundingClientRect();
    const imageWidth = productRect.width;
    const imageHeight = productRect.height;

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
    svg.style.borderRadius = "0";
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

    function loadGoogleFontIfNeeded(fontName) {
        if (!fontName || loadedFontsTest.has(fontName)) return;

        const fontSlug = fontName.replace(/ /g, "+");
        const fontUrl = `https://fonts.googleapis.com/css2?family=${fontSlug}&display=swap`;

        const link = document.createElement("link");
        link.href = fontUrl;
        link.rel = "stylesheet";
        document.head.appendChild(link);

        loadedFontsTest.add(fontName);
    }

    function addText(x, y, rotate = 0) {
        loadGoogleFontIfNeeded(data.font);

        const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
        const fontSizeForText = isMobile ? data.fontSizeMobile : data.fontSize;

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

    // ✅ ALL YOUR BACKGROUND LOGIC (UNCHANGED)
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
    outer.setAttribute("data-label-text-id", data.id);

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

    // ✅ animation (NO transformPrefix)
    if (data.animationType !== "NONE") {
        const opacity = data.opacity / 100;
        const animationName = `asfText_${data.animationType}`;

        let keyframes = "";

        switch (data.animationType) {
            case "FLASH":
                keyframes = `@keyframes ${animationName} {
          0% { opacity: 0; }
          100% { opacity: ${opacity}; }
        }`;
                break;
            case "ZOOM_IN":
                keyframes = `@keyframes ${animationName} {
          0% { transform: scale(0); opacity: ${opacity}; }
          100% { transform: scale(1); opacity: ${opacity}; }
        }`;
                break;
            case "ZOOM_OUT":
                keyframes = `@keyframes ${animationName} {
          0% { transform: scale(1); opacity: ${opacity}; }
          100% { transform: scale(0); opacity: ${opacity}; }
        }`;
                break;
            case "SWING":
                keyframes = `@keyframes ${animationName} {
          0% { transform: rotate(0deg); opacity: ${opacity}; }
          25% { transform: rotate(15deg); opacity: ${opacity}; }
          50% { transform: rotate(-15deg); opacity: ${opacity}; }
          100% { transform: rotate(0deg); opacity: ${opacity}; }
        }`;
                break;
            case "ROLL_IN":
                keyframes = `@keyframes ${animationName} {
          0% { transform: translateX(-100%) rotate(-120deg); opacity: 0; }
          100% { transform: translateX(0) rotate(0deg); opacity: ${opacity}; }
        }`;
                break;
            case "ROLL_OUT":
                keyframes = `@keyframes ${animationName} {
          0% { transform: translateX(0) rotate(0deg); opacity: ${opacity}; }
          100% { transform: translateX(100%) rotate(120deg); opacity: 0; }
        }`;
                break;
        }

        if (!injectedTextAnimationsTest.has(animationName)) {
            const styleSheet = document.createElement("style");
            styleSheet.innerHTML = keyframes;
            document.head.appendChild(styleSheet);
            injectedTextAnimationsTest.add(animationName);
        }

        outer.style.animation = `${animationName} ${data.duration}s ${data.repeatAnimation}`;
    }

    outer.appendChild(container);
    imageContainer.appendChild(outer);
}

const observer = new MutationObserver(() => {
    mainFunctionLabels();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

