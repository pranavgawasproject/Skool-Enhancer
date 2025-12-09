# Icons for Skool Enhancer

You need to create 3 icon sizes for your extension:

## Required Files:
- `icon16.png`  (16x16 pixels)
- `icon48.png`  (48x48 pixels)
- `icon128.png` (128x128 pixels)

## Quick Option: Use Emoji as Icon
You can create simple icons using this online tool:
1. Go to: https://favicon.io/emoji-favicons/
2. Search for "graduation-cap" or "bookmark"
3. Download all sizes
4. Rename to icon16.png, icon48.png, icon128.png

## Design Option: Create Custom Icon
1. Use Figma (free): https://figma.com
2. Create 128x128 artboard
3. Design your icon (graduation cap + bookmark)
4. Export at 16, 48, and 128 sizes

## Placeholder Icon Generator

Create a file called `generate-icons.html` and open it in your browser to generate placeholder icons:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Generate Icons</title>
</head>
<body>
  <h1>Click to Download Icons</h1>
  <button onclick="generateIcons()">Generate All Icons</button>
  <script>
    function generateIcons() {
      const sizes = [16, 48, 128];
      sizes.forEach(size => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Gradient background
        const gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        
        // Draw rounded rectangle
        const radius = size * 0.2;
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(size - radius, 0);
        ctx.quadraticCurveTo(size, 0, size, radius);
        ctx.lineTo(size, size - radius);
        ctx.quadraticCurveTo(size, size, size - radius, size);
        ctx.lineTo(radius, size);
        ctx.quadraticCurveTo(0, size, 0, size - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
        ctx.fill();
        
        // Add text
        ctx.fillStyle = 'white';
        ctx.font = `bold ${size * 0.5}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('S', size/2, size/2);
        
        // Download
        const link = document.createElement('a');
        link.download = `icon${size}.png`;
        link.href = canvas.toDataURL();
        link.click();
      });
    }
  </script>
</body>
</html>
```

## Color Scheme
The extension uses this gradient:
- Primary: `#667eea`
- Secondary: `#764ba2`
