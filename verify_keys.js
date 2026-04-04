require('dotenv').config();
const ai = require('./utils/ai');

async function verify() {
    const text = "The solar system consists of the Sun and everything that orbits it, including eight planets.";
    console.log("Testing Slides...");
    const slides = await ai.generateSlides(text);
    console.log("Slides Keys:", Object.keys(slides));
    if (slides.slides && slides.slides[0]) {
        console.log("First Slide Keys:", Object.keys(slides.slides[0]));
    }

    console.log("\nTesting Infographic...");
    const info = await ai.generateInfographic(text);
    console.log("Infographic Keys:", Object.keys(info));
    if (info.infographic && info.infographic[0]) {
        console.log("First Info Keys:", Object.keys(info.infographic[0]));
    }
}

verify();
