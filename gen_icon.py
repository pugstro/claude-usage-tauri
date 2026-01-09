import tkinter as tk
from PIL import Image, ImageDraw

# Create a 64x64 image with 100% transparency
img = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Draw a stylized "C" gauge path
# Outer arc
draw.arc([8, 8, 56, 56], start=45, end=315, fill=(255, 255, 255, 255), width=6)

# Inner arc for that gauge look
draw.arc([16, 16, 48, 48], start=60, end=300, fill=(255, 255, 255, 255), width=4)

# Gauge needle/indicator
draw.line([32, 32, 54, 10], fill=(255, 255, 255, 255), width=4)

img.save('src-tauri/resources/tray-icon.png')
