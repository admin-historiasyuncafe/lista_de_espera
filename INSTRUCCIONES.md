# Guía de Configuración - Historias Waitlist App

Sigue estos pasos para poner a funcionar tu nueva aplicación:

## 1. Google Apps Script (El Backend)
1. Abre tu Google Sheet donde se guardan las respuestas del formulario.
2. Ve al menú **Extensiones** > **Apps Script**.
3. Copia el contenido del archivo `backend_script.gs` que he creado y pégalo en el editor de Apps Script.
4. **IMPORTANTE:** Rellena las constantes al principio del script:
   - `SPREADSHEET_ID`: El ID de tu Google Sheet (está en el URL: `docs.google.com/spreadsheets/d/[ID_AQUÍ]/edit`).
   - `SHEET_NAME`: El nombre de la pestaña (ej: 'Respuestas de formulario 1').
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`: Tus credenciales de Twilio.
5. Haz clic en el botón azul **Implementar** > **Nueva implementación**.
6. En el tipo, selecciona **App web**.
7. En "Quién tiene acceso", selecciona **Cualquier persona**. (Esto es necesario para que la app frontend pueda comunicarse sin autenticación compleja).
8. Haz clic en **Implementar**, autoriza los permisos y **copia el URL de la App Web** generado.

## 2. Configurar el Frontend
1. Abre el archivo `app.js` en tu computadora.
2. En la primera línea, pega el URL que copiaste en la variable `BACKEND_URL`:
   ```javascript
   const BACKEND_URL = 'https://script.google.com/macros/s/..../exec';
   ```
3. Guarda el archivo.

## 3. Ejecutar la Aplicación
Para ver la app, simplemente abre el archivo `index.html` en cualquier navegador (Chrome, Safari, etc.).

---

### ¿Cómo funciona ahora?
- La Host verá la lista de personas que se han registrado.
- Al darle a **Enviar SMS**, se dispara el mensaje de Twilio y se marca como `NOTIFICADO` en el Sheet.
- Al darle a **Sentar (🪑)** o **No llegó (❌)**, el cliente desaparece de la vista "Activos" y se guarda el estado final en el Sheet para siempre.
- La vista de **Historial** te permite ver lo que pasó en el día sin que estorbe en la lista de espera principal.
