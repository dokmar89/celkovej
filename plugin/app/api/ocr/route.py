import os
import tempfile
from flask import Flask, request, jsonify
from google.cloud import storage
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
from dateutil.parser import parse
import re
import logging
import base64

app = Flask(__name__)

# Nastavte cestu k Tesseract executable, pokud není na PATH
pytesseract.pytesseract.tesseract_cmd = '/usr/bin/tesseract'

MAX_FILE_SIZE = 5 * 1024 * 1024  # Maximální velikost souboru: 5 MB
SUPPORTED_LANGUAGES = ['eng', 'ces']  # Podporované jazyky pro OCR

# Nastavení logování
logger = logging.getLogger()
logger.setLevel(logging.DEBUG)

def validate_api_key(api_key):
    """Simulace validace API klíče (pro produkci nahradit skutečnou validací)."""
    return api_key == os.environ.get('OCR_API_KEY')  # API klíč z proměnných prostředí

@app.route('/ocr', methods=['POST'])
def ocr_function():
    """Cloud Function pro OCR extrakci dat z obrázku."""
    try:
        # Ověření API klíče
        api_key = request.headers.get('API-Key')
        if not validate_api_key(api_key):
            logger.warning('Neplatný API klíč.')
            return jsonify({"error": "Neplatný API klíč."}), 403

        # Ověření, že byl poskytnut soubor
        if 'file' not in request.files:
            logger.warning('Žádný soubor nebyl poskytnut.')
            return jsonify({"error": "Žádný soubor nebyl poskytnut."}), 400

        file = request.files['file']

        if file.filename == '':
            logger.warning('Žádný soubor nebyl vybrán.')
            return jsonify({"error": "Žádný soubor nebyl vybrán."}), 400
        
        if len(file.read()) > MAX_FILE_SIZE:
             logger.warning('Příliš velký soubor.')
            return jsonify({"error": "Příliš velký soubor."}), 400

        file.seek(0)  # Resetuje ukazatel čtení souboru
        
        # Ověření Content-Type
        if not file.content_type.startswith('image/'):
            logger.warning('Neplatný Content-Type.')
            return jsonify({"error": "Neplatný Content-Type. Očekáván obrázek."}), 400

        # Uložení souboru do dočasného adresáře
        with tempfile.NamedTemporaryFile(delete=False) as temp:
            file.save(temp.name)
            temp_filename = temp.name

        # Načtení obrázku a předzpracování
        image = Image.open(temp_filename)
        image = image.convert('L')  # Převod na černobílou
        image = image.filter(ImageFilter.MedianFilter())
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(2)  # Zvýšení kontrastu

        # OCR s podporou více jazyků
        ocr_result = pytesseract.image_to_string(image, lang='+'.join(SUPPORTED_LANGUAGES))
        
        # Extrakce data narození s více vzory a validací
        date_patterns = [
            r'\b(\d{2}\.\d{2}\.\d{4})\b',  # DD.MM.YYYY
            r'\b(\d{4}-\d{2}-\d{2})\b',      # YYYY-MM-DD
            r'\b(\d{2}/\d{2}/\d{4})\b'       # MM/DD/YYYY
        ]
        date_of_birth = None
        for pattern in date_patterns:
            match = re.search(pattern, ocr_result)
            if match:
                try:
                    parsed_date = parse(match.group(0)).date()
                    date_of_birth = str(parsed_date)
                    break
                except ValueError:
                    logger.debug(f'Neplatný formát data: {match.group(0)}')
                    continue

        if not date_of_birth:
             logger.warning('Datum narození nebylo nalezeno.')
            date_of_birth = "Datum narození nebylo nalezeno."

        # Vrácení výsledku
        return jsonify({
            "ocr_text": ocr_result,
            "date_of_birth": date_of_birth
        })
    except Exception as e:
        logger.exception('Chyba při zpracování OCR:')
        return jsonify({"error": f"Došlo k chybě: {str(e)}"}), 500
    finally:
        # Vyčištění dočasného souboru
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

# Firebase funkce pro nasazení
if __name__ == '__main__':
    app.run(debug=True)