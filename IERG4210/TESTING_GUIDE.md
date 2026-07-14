# ShopHub Form Submission & Image Resizing - User Guide

## Quick Start

### 1. Start the Server
```powershell
npm run build   # Build React app
npm run server  # Start Node.js server on port 3000
```

Then visit:
- **Home Page**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin/products.html

---

## Testing Form Submission

### Admin Products Page: [http://localhost:3000/admin/products.html](http://localhost:3000/admin/products.html)

#### **Create New Product**
1. Click **"Create New"** button
2. Fill in the form:
   - **Category**: Select from dropdown (Electronics, Books, etc.)
   - **Name**: Product name
   - **Price**: Product price (e.g., 99.99)
   - **Description**: Product description
   - **Images**: Click to select one or multiple image files

3. Click **"Save"**
4. You'll see the new product appear in the "Existing" list below

#### **Upload Multiple Images**
1. Select the **"Images"** input field
2. Select 2+ image files at once (supported: JPG, PNG, SVG)
3. Server will automatically:
   - Create large version: 1024×1024px
   - Create thumbnail: 300×300px
   - Save both to database

#### **Edit Existing Product**
1. In the "Existing" products list, click **"Edit"** button
2. Modify any field (name, price, description, etc.)
3. Optionally upload new images
4. Click **"Save"**

#### **Delete Product**
1. Click **"Delete"** button next to a product
2. Confirm deletion

---

## Testing Image Resizing

### How to Verify Images Are Resized

1. **Upload a large image** (e.g., 3000×2000px)
2. Open file explorer: `c:\Users\user\Downloads\IERG4210\public\images\products\`
3. Look for files with pattern: `{product-id}-{image-number}-large.ext` and `{product-id}-{image-number}-thumb.ext`

**Example:**
```
Product ID 12, Image 1:
- 12-1-large.jpg  (1024×1024, resized)
- 12-1-thumb.jpg  (300×300, resized)

Product ID 12, Image 2:
- 12-1-large.svg  (SVG, copied as-is)
- 12-1-thumb.svg  (SVG, copied as-is)
```

### Verify Image Display

#### **On Home Page** [http://localhost:3000/](http://localhost:3000/)
- Products display with **thumbnail images** (300×300px)
- These are loaded from the `-thumb` versions
- Faster loading due to smaller file size

#### **On Product Detail Page** [http://localhost:3000/product/19](http://localhost:3000/product/19)
- Product displays with **full-size images** (1024×1024px)
- These are loaded from the `-large` versions
- Better quality for detailed viewing
- Swiper gallery lets you:
  - Click arrows to navigate between multiple images
  - Pinch/zoom to magnify (up to 2x)
  - Click dots for pagination

---

## Database Records

### View Products in Database
```powershell
# Query via API to see database structure
Invoke-WebRequest -Uri "http://localhost:3000/api/products" -UseBasicParsing | `
  Select-Object -ExpandProperty Content | ConvertFrom-Json
```

### Database File Location
```
c:\Users\user\Downloads\IERG4210\data\shop.db
```

### Database Schema
```sql
products table:
- pid: Product ID (auto-increment)
- catid: Category ID (foreign key)
- name: Product name
- price: Product price
- description: Product description
- image_path: First image large path
- images: JSON array of all large image paths

Example images field:
["/images/products/19-1-large.svg", "/images/products/19-2-large.svg"]
```

---

## API Testing

### Create Product (with images)

**Endpoint**: `POST /api/products/create`

**PowerShell Example:**
```powershell
$file = Get-Item "path/to/image.jpg"
$uri = "http://localhost:3000/api/products/create"
$form = @{
    catid = "1"
    name = "Test Product"
    price = "199.99"
    description = "Test description"
    images = $file
}

$response = Invoke-WebRequest -Uri $uri -Method Post -Form $form -UseBasicParsing
$response.Content | ConvertFrom-Json

# Response: {"pid": 20}
```

### Update Product

**Endpoint**: `POST /api/products/update`

**PowerShell Example:**
```powershell
$updateBody = @{
    pid = "20"
    catid = "1"
    name = "Updated Name"
    price = "249.99"
    description = "Updated description"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/products/update" `
  -Method Post -ContentType "application/json" `
  -Body $updateBody -UseBasicParsing | `
  Select-Object -ExpandProperty Content

# Response: {"changes": 1}
```

### Get All Products

**Endpoint**: `GET /api/products`

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/products" -UseBasicParsing | `
  Select-Object -ExpandProperty Content | ConvertFrom-Json | `
  ForEach-Object { Write-Host "$($_.name): $($_.price)" }
```

### Get Single Product with Images

**Endpoint**: `GET /api/product/{id}`

```powershell
$productId = 19
Invoke-WebRequest -Uri "http://localhost:3000/api/product/$productId" -UseBasicParsing | `
  Select-Object -ExpandProperty Content | ConvertFrom-Json | `
  ConvertTo-Json -Depth 3
```

**Response Example:**
```json
{
  "pid": 19,
  "catid": 14,
  "name": "Adidas",
  "price": 568,
  "description": "ggg",
  "image_path": "/images/products/19-1-large.svg",
  "images": [
    "/images/products/19-1-large.svg",
    "/images/products/19-2-large.svg"
  ],
  "category_name": "Clothe",
  "image_thumb": "/images/products/19-1-thumb.svg"
}
```

---

## Troubleshooting

### Issue: Images not showing on home page
**Solution**: Check browser DevTools → Network tab to see if thumb images load
- Expected URL: `/images/products/{pid}-{idx}-thumb.{ext}`
- Check file exists in: `public/images/products/`

### Issue: Product detail page shows no image
**Solution**: 
- Verify images array in database has entries
- Check if `-large` version files exist
- Clear browser cache (Ctrl+Shift+Delete)

### Issue: Large images not resized to thumbnail
**Solution**:
- Verify Sharp package installed: `npm list sharp`
- Check server console for resize errors
- Try re-uploading images

### Issue: Can't upload images
**Solution**:
- Check `public/images/products/` directory exists
- Check `uploads/` directory exists
- Verify server has write permissions
- Check file size < 10MB (configured limit)

### Issue: SVG files show incorrectly
**Solution**:
- SVG files are copied as-is without rasterization
- This is intentional for scalable images
- To convert SVG to PNG, upload PNG instead

---

## File Locations Reference

| Component | Location |
|-----------|----------|
| Admin Form | `public/admin/products.html` |
| Home Page | `src/pages/Home.js` |
| Product Detail | `src/pages/ProductDetail.js` |
| Image Slider | `src/pages/ImageSlider.js` |
| Backend Server | `server.js` |
| Database | `data/shop.db` |
| Product Images | `public/images/products/` |
| Temp Uploads | `uploads/` (deleted after processing) |

---

## Advanced: Force Rebuild & Fresh Start

If you need to completely reset:

```powershell
# Delete database
Remove-Item -Path "data/shop.db" -Force

# Delete generated images
Get-ChildItem -Path "public/images/products" -Filter "*-large.*" -o Files | Remove-Item
Get-ChildItem -Path "public/images/products" -Filter "*-thumb.*" -o Files | Remove-Item

# Rebuild
npm run build

# Restart
npm run server
```

This will:
- Reset database with seed data
- Remove all uploaded images
- Rebuild React app
- Start fresh server

---

## Success Checklist

- ✅ Form submits without errors
- ✅ Products appear in "Existing" list
- ✅ Images uploaded and visible
- ✅ Thumbnails show on home page (300×300px)
- ✅ Full images show on detail page (1024×1024px)
- ✅ Multiple images can be uploaded per product
- ✅ Image gallery slider works with navigation
- ✅ Products persist after page refresh
- ✅ Delete removes product and images
- ✅ Update modifies database entry

---

**Need Help?** Check the browser console (F12 → Console) for error messages.
