# Studio Stuiter Portfolio Website

## Summary
Studio Stuiter is a portfolio website for Daan Hobbel, a designer and developer. The website showcases various projects with an interactive bouncing ball animation feature that allows visitors to interact with the site in a playful way.

## Structure
- **root**: Main HTML, CSS, and JavaScript files
- **images**: Contains logo and project images organized by project
- **font**: Custom fonts including Ruddy and Colfax
- **4x**: Purpose unknown, likely additional assets

## Language & Runtime
**Language**: HTML, CSS, JavaScript (ES6+)
**Build System**: None (static website)

## Main Components

### Interactive Animation
**Main File**: `bouncyShapes.js`
**Type**: ES6 Module
**Features**:
- Interactive bouncing shapes with physics simulation
- Customizable gravity, bounce factor, and collision detection
- Device motion/accelerometer support for mobile interaction
- Viewport-edge momentum and window-drag inertial acceleration

```javascript
// Example usage
const playground = new BouncyShapesPlayground({
  canvas: '#canvas',
  gravity: 1.0,
  bounceFactor: 0.95,
  clickBoost: 40,
  pattern: 'random'
});
```

### User Interface
**Main File**: `home.html`
**Features**:
- Responsive design for various screen sizes
- Side menu with personal information
- Project filtering system with categories
- Interactive settings for the bouncy animation
- Project gallery with modal image viewer

```html
<!-- Project filtering example -->
<div class="filter-buttons">
  <button class="filter-btn active" data-filter="all">Alle</button>
  <button class="filter-btn" data-filter="web">Web Design</button>
  <button class="filter-btn" data-filter="xr">XR</button>
  <!-- Additional filters -->
</div>
```

### Styling
**Main File**: `style.css`
**Features**:
- Custom font integration (Ruddy and Colfax)
- Responsive layout using modern CSS techniques
- Custom color scheme defined with CSS variables
- Animation effects for interactive elements

```css
/* Color scheme */
:root {
  --bg-color:#800263;
  --studio-color: #FFA300;
  --stuiter-color: #4894b0;
  --accent-color: #FF3B30;
  --text-light: #f4f4f4;
  --text-dark: #323232;
  --background: #e2bf95;
}
```

## Projects Showcase
The website features several projects including:
- Vleugellam (Interactive Installation)
- Potgrond (Web Design)
- Future Botanica
- Generative Social Dances
- Limescoop

Each project is displayed with:
- Featured image
- Project title and brief description
- Technology tags
- Detailed view with comprehensive information and gallery

## Assets
**Images**: Organized in `/images/projects/[ProjectName]` directories
**Fonts**: 
- Ruddy (custom font in TTF format)
- Colfax (custom font in OTF format)
- Adobe Typekit integration (`xsq4yeu.css`)

## Browser Compatibility
The website uses modern JavaScript features (ES6+) and CSS techniques:
- ES6 Classes and Modules
- CSS Grid and Flexbox
- Device Motion API (with iOS permission handling)
- Canvas API for animations

## Known Issues
As noted in code comments:
- Side menu cuts off at the bottom on mobile
- Touch interaction issues on iOS Safari
- Bouncing physics improvements needed for obstacles