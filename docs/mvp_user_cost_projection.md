# Proyección de Costos: PostalPeek MVP (User-Driven)

Este documento proyecta los costos de infraestructura para el modelo actual de PostalPeek, donde los **usuarios interactúan directamente** con el explorador 3D para navegar por Street View y capturar fotos, en contraste con el modelo anterior de *Backend Engine* automatizado.

## 1. Arquitectura de Costos

Cada sesión de juego (una "Misión" o "Exploración Libre") implica típicamente el siguiente ciclo:

1. **Carga del Panorama (Street View JS API):** El usuario aterriza en Street View y puede moverse interactivamente.
2. **Captura Fotográfica (Static Street View API):** El usuario encuadra y toma una foto de la ubicación.
3. **Análisis de IA (Gemini 2.5 Flash):** Se evalúa la foto y se genera la narrativa de la postal.
4. **Almacenamiento (Supabase & Cloudflare R2):** Se guarda la metadata en Postgres y la imagen final en el bucket R2.

---

## 2. Desglose de Precios por Unidad

| Servicio | Acción | Costo base |
| :--- | :--- | :--- |
| **Google Maps Dynamic Street View** | Iniciar la experiencia interactiva de Street View | **$14.00 USD** / 1,000 requests |
| **Google Maps Static Street View** | Tomar la "foto" final encuadrada | **$7.00 USD** / 1,000 requests |
| **Google Gemini (AI Studio)** | Análisis de imagen y narrativa | **$0.00 USD** (Experimental/Free tier actual) |
| **Supabase (Edge Functions + DB)** | Lógica backend y guardado de metadata | **$0.00 USD** (Entra holgadamente en cuota mensual) |
| **Cloudflare R2** | Guardar la imagen JPG resultante | **$0.00 USD** (Regala 10GB de storage y ancho de banda infinito) |

> **Costo unitario por "Sesión de Foto": ~$0.021 USD** (2.1 centavos por foto completada).

---

## 3. El Subsidio Google (The "Solo-Preneur Hack")

Google Maps otorga un **crédito gratuito y recurrente de $200 USD todos los meses**.
Dado nuestro costo por sesión de ~$0.021, esto significa que PostalPeek puede soportar aproximadamente **9,500 exploraciones completas al mes a costo exactamente de $0.00 USD**.

---

## 4. Escenarios de Proyección

### Escenario A: MVP / Tracción Inicial (Totalmente Gratis)
* **Volumen:** 100 Usuarios Activos Mensuales (MAU) tomando 10 fotos al mes cada uno.
* **Sesiones:** 1,000 exploraciones mensuales.
* **Costo Google Maps:** $21.00 USD.
* **A pagar:** **$0.00 USD** (Cubierto por crédito de $200).

### Escenario B: Crecimiento Moderado (Límite del Free Tier)
* **Volumen:** 1,000 MAU tomando ~9.5 fotos al mes cada uno.
* **Sesiones:** 9,500 exploraciones mensuales.
* **Costo Google Maps:** ~$199.50 USD.
* **A pagar:** **$0.00 USD** (Apenas cubierto por crédito de $200).

### Escenario C: Escalamiento Exitoso
* **Volumen:** 5,000 MAU tomando 10 fotos al mes cada uno.
* **Sesiones:** 50,000 exploraciones mensuales.
* **Costo Google Maps:** $1,050.00 USD.
* **A pagar:** **$850.00 USD / mes** ($1,050 - $200 de crédito).

---

## 5. Riesgos y Estrategias de Mitigación

1. **Abuso del Dynamic Panorama:** Si el usuario abre Street View pero nunca toma la foto, incurrimos en el costo de los $14/1000 sin llegar al análisis de IA.
   * *Mitigación:* Se puede limitar la cantidad de "Misiones de Exploración" permitidas por día a nivel backend antes de solicitar al usuario esperar a que se recarguen sus "Tickets de Viaje", protegiendo nuestra API key.
2. **Cambios en Pricing de Gemini:** Si Flash sale de la beta gratuita, el costo en tokens visuales sigue siendo extraordinariamente bajo (una fracción de centavo por imagen). No representa un peligro inmediato en comparación a Maps.

## Conclusión

El pivote a un **MVP impulsado por el usuario** es mucho más eficiente que un cron job, asegurando que solo pagamos (o gastamos de nuestra cuota) cuando hay un *engagement real* y voluntad de juego. La aplicación es inherentemente rentable de arrancar en el ecosistema "Entity Builders" debido al alto límite de gratuidad que soporta el uso temprano.
