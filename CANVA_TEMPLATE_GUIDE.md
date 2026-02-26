# Canva Brand Template Design Guide

## Overview

Once Canva approves our Enterprise dev access, we'll create 3 Brand Templates (one for each aspect ratio) that can be autofilled with AI-generated content.

## Template Specifications

### Aspect Ratios Needed

1. **Square (1:1)** - 1080x1080px - Instagram Feed, Facebook
2. **Portrait (4:5)** - 1080x1350px - Instagram Feed, Facebook
3. **Story (9:16)** - 1080x1920px - Instagram Stories, TikTok, YouTube Shorts

### Data Fields Required

Each template must have these autofillable fields configured via the "Data autofill" app:

#### Text Fields
- `HEADLINE` (text) - Main headline, bold, large
- `SUBHEADLINE` (text, optional) - Secondary text, medium size
- `BENEFIT_1` (text) - First benefit callout
- `BENEFIT_2` (text) - Second benefit callout  
- `BENEFIT_3` (text) - Third benefit callout
- `CTA` (text) - Call to action (e.g., "Shop Now", "Learn More")

#### Image Fields
- `PRODUCT_IMAGE` (image) - Product render with transparent background
- `BACKGROUND` (image) - Background scene/texture

### Static Elements (Not Autofillable)

These should be designed into the template and NOT marked as data fields:

- **ONEST logo** - Positioned consistently (top-left or bottom-right)
- **Brand colors** - Use ONEST palette (#FF3838 red, #0347ED blue, #01040A dark)
- **Typography** - Use bold sans-serif for headlines, clean sans for body
- **Layout structure** - Product placement zone, text hierarchy zones
- **Decorative elements** - Subtle shapes, gradients, or patterns

## Design Guidelines

### Layout Principles

**Product Placement:**
- Product should occupy 30-40% of canvas
- Position: Right side or center, depending on background
- Ensure product doesn't overlap critical text

**Text Hierarchy:**
- Headline: Top or middle, 60-80pt, bold
- Subheadline: Below headline, 30-40pt, regular weight
- Benefits: Listed vertically or horizontally, 20-30pt, icons optional
- CTA: Bottom, button style or bold text, 24-36pt

**Background:**
- Should enhance product, not compete with it
- Lifestyle scenes work well (gym, kitchen, outdoor)
- Ensure sufficient contrast for text readability

### Color Strategy

**Option 1: Light Background**
- Background: Light/neutral tones
- Text: Dark (#01040A) for readability
- Accents: Red (#FF3838) or Blue (#0347ED) for CTA

**Option 2: Dark Background**
- Background: Dark/moody tones
- Text: White (#FFFFFF) for readability
- Accents: Red (#FF3838) or Blue (#0347ED) for highlights

### Typography Rules

- **Headline font:** Bold, attention-grabbing (e.g., Montserrat Bold, Poppins Bold)
- **Body font:** Clean, readable (e.g., Inter, Open Sans)
- **Line height:** 1.2-1.4 for headlines, 1.5-1.8 for body
- **Text alignment:** Left or center, avoid right alignment
- **Text boxes:** Add padding/background for readability over busy backgrounds

## Step-by-Step Template Creation

### Phase 1: Design the Template (Manual in Canva)

1. **Create New Design**
   - Log into Canva with Enterprise account
   - Create custom size (1080x1080 for square)
   - Name it "ONEST Ad Template - Square 1:1"

2. **Add Background Layer**
   - Insert empty image frame, size to full canvas
   - Send to back (Position → To back)
   - This will be the `BACKGROUND` data field

3. **Add Product Layer**
   - Insert empty image frame (400x400px for square format)
   - Position on right side or center
   - This will be the `PRODUCT_IMAGE` data field

4. **Add ONEST Logo**
   - Upload ONEST logo as static element
   - Position in top-left or bottom-right corner
   - Size: 80-120px width
   - Do NOT mark as data field (static)

5. **Add Text Placeholders**
   - Add text box for headline: "Your Headline Here"
   - Add text box for subheadline: "Supporting text goes here"
   - Add 3 text boxes for benefits: "Benefit 1", "Benefit 2", "Benefit 3"
   - Add text box for CTA: "Shop Now"
   - Style each with appropriate fonts, sizes, colors

6. **Add Decorative Elements (Optional)**
   - Subtle shapes, lines, or gradients
   - Keep minimal to avoid visual clutter
   - Do NOT mark as data fields (static)

### Phase 2: Configure Data Autofill App

1. **Open Data Autofill App**
   - In Canva editor, click Apps (left sidebar)
   - Search "Data autofill"
   - Select "Custom" as data source
   - Click "Continue"

2. **Mark Background as Data Field**
   - Select the background image frame
   - Click "Data Field" button (appears when app is open)
   - Type: `BACKGROUND`
   - Field type: Image (auto-detected)

3. **Mark Product as Data Field**
   - Select the product image frame
   - Click "Data Field" button
   - Type: `PRODUCT_IMAGE`
   - Field type: Image (auto-detected)

4. **Mark Text Fields as Data Fields**
   - Select headline text box → Click "Data Field" → Type: `HEADLINE`
   - Select subheadline text box → Click "Data Field" → Type: `SUBHEADLINE`
   - Select benefit 1 text box → Click "Data Field" → Type: `BENEFIT_1`
   - Select benefit 2 text box → Click "Data Field" → Type: `BENEFIT_2`
   - Select benefit 3 text box → Click "Data Field" → Type: `BENEFIT_3`
   - Select CTA text box → Click "Data Field" → Type: `CTA`

5. **Verify Data Fields**
   - In Data autofill app panel, you should see all 8 fields listed:
     - BACKGROUND (image)
     - PRODUCT_IMAGE (image)
     - HEADLINE (text)
     - SUBHEADLINE (text)
     - BENEFIT_1 (text)
     - BENEFIT_2 (text)
     - BENEFIT_3 (text)
     - CTA (text)

### Phase 3: Publish as Brand Template

1. **Publish Template**
   - Click "Share" button (top-right)
   - Select "Publish as brand template"
   - Add template name: "ONEST Ad - Square 1:1"
   - Add description: "AI-generated ad template with autofillable headline, benefits, product, and background"
   - Click "Publish"

2. **Get Template ID**
   - After publishing, open the brand template
   - Copy the URL: `https://www.canva.com/brand/brand-templates/XXXXX`
   - The template ID is the `XXXXX` part at the end
   - Save this ID - we'll need it for the API

3. **Repeat for Other Aspect Ratios**
   - Create portrait version (1080x1350px)
   - Create story version (1080x1920px)
   - Adjust layout proportions for each aspect ratio
   - Publish each and save their template IDs

## Template IDs Storage

After creating all templates, store their IDs in the system:

```typescript
// In server/_core/env.ts or a config file
export const CANVA_TEMPLATE_IDS = {
  SQUARE: "AEN3TrQftXo", // 1:1 (1080x1080)
  PORTRAIT: "BFO4UsRguYp", // 4:5 (1080x1350)
  STORY: "CGP5VtShvZq", // 9:16 (1080x1920)
};
```

## Testing Templates

Before integrating with the pipeline:

1. **Manual Test in Canva**
   - Open the published brand template
   - Use Data autofill app in Canva UI
   - Fill in sample data manually
   - Verify all fields populate correctly
   - Check text doesn't overflow boxes
   - Verify images fit properly

2. **API Test**
   - Use Postman or curl to test the API
   - Query template dataset: `GET /v1/brand-templates/{id}/dataset`
   - Create autofill job with sample data
   - Verify job completes and design is editable

## Next Steps

1. ✅ Wait for Canva Enterprise dev access approval (2-5 days)
2. ⏳ Create 3 Brand Templates following this guide
3. ⏳ Test templates manually in Canva UI
4. ⏳ Implement backend autofill integration
5. ⏳ Update frontend to show "Create Editable Design" option
6. ⏳ Test end-to-end workflow

---

**Last Updated:** 26 February 2026  
**Status:** Waiting for Enterprise dev access approval  
**Templates Created:** 0/3
