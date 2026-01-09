from PIL import Image, ImageDraw

img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)
draw.ellipse([2, 2, 30, 30], outline=(255, 255, 255, 255), width=4)
draw.rectangle([16, 8, 32, 24], fill=(0, 0, 0, 0))
img.save('src-tauri/resources/tray-icon.png')
