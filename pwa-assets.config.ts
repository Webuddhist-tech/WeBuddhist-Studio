import { defineConfig } from "@vite-pwa/assets-generator/config";

// Builds the install icons in public/ from public/pwa-icon.svg:
// `npm run generate-pwa-assets`. The source is already a full-bleed red square
// with the flower inside the maskable safe zone, so nothing gets padded here.
const brandRed = "#AC1B21";

export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    transparent: {
      sizes: [64, 192, 512],
      padding: 0,
    },
    maskable: {
      sizes: [512],
      padding: 0,
      resizeOptions: { background: brandRed },
    },
    apple: {
      sizes: [180],
      padding: 0,
      resizeOptions: { background: brandRed },
    },
  },
  images: ["public/pwa-icon.svg"],
});
