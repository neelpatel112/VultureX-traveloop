import fitz
import os

doc = fitz.open(r'd:\hackethon\Traveloop.pdf')
with open(r'd:\hackethon\pdf_content.txt', 'w', encoding='utf-8') as f:
    for i, page in enumerate(doc):
        f.write(f'=== PAGE {i+1} ===\n')
        f.write(page.get_text())
        f.write('\n\n')

    # Also extract images info
    f.write('\n=== IMAGES INFO ===\n')
    for i, page in enumerate(doc):
        images = page.get_images()
        if images:
            f.write(f'Page {i+1} has {len(images)} images\n')
            for img_idx, img in enumerate(images):
                xref = img[0]
                f.write(f'  Image {img_idx}: xref={xref}, size={img[2]}x{img[3]}\n')

print('Done. Total pages:', len(doc))
