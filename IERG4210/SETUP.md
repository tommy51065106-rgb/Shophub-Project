# Setup Instructions

## Install Dependencies

Make sure you have installed all dependencies including Swiper:

```bash
npm install
```

If Swiper is not installed, install it manually:

```bash
npm install swiper
```

## Troubleshooting Image Issues

If images are not displaying:

1. **Check browser console** for any errors
2. **Verify Swiper is installed**: Run `npm list swiper`
3. **Check network tab** to see if images are loading
4. **Try a different browser** to rule out browser-specific issues

## Testing the Image Slider

1. Start the development server: `npm start`
2. Navigate to any product page (e.g., `/product/1`)
3. You should see:
   - Main image slider with navigation arrows
   - Pagination dots at the bottom
   - Thumbnail images below (if multiple images)
   - Zoom functionality (double-click or pinch)

## Image URLs

The current implementation uses placeholder.com for sample images. Replace these with your actual product images when ready.
