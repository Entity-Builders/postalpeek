# Proyección de Costos: Postal Peek Backend Engine

Dado que el Cron Job actualizamos su frecuencia a **1 vez por minuto**, esto significa:
* **60 ejecuciones por hora**
* **1,440 ejecuciones por día**
* **43,200 ejecuciones al mes (30 días)**

A continuación, un desglose de los costos aproximados mensuales por cada servicio que utilizamos en el ciclo, considerando que cada intento es exitoso al 100% y no hay 404s excesivos.

---

## 1. Google Maps Static API

- **Uso:** 1 llamada por minuto para descargar la imagen Street View original.
- **Volumen:** 43,200 peticiones / mes.
- **Precio Google:** $7.00 USD por cada 1,000 peticiones (con los primeros $200 de crédito mensual gratuito que equivalen a ~28,500 peticiones).
- **Cálculo:** 
  - 43,200 * ($7.00 / 1000) = $302.40 USD.
  - Aplicando el crédito perpetuo de $200 USD: $302.40 - $200 = **$102.40 USD / mes**

> **🚨 ZONA DE PELIGRO:** Este es el servicio más caro. Si dejas el cron corriendo 24/7 a razón de 1 minuto, *te costará dinero real*.

---

## 2. Gemini 2.5 Flash (Texto e Imagen)

Actualmente estamos usando la API de Gemini (Google AI Studio). 
Hasta la fecha, el acceso a la API experimental para desarrolladores es **GRATUITO** bajo el tier de "Free of Charge" (con límites de rate, como 15 RPM).
Dado que el cron invoca la IA 1 vez por minuto, estamos muy por debajo del rate limit.

- **Volumen:** 
  - Text Analysis: 43,200 peticiones / mes.
  - Image Generation: 43,200 peticiones / mes.
- **Costo Actual:** **$0.00 USD / mes** (sujeto a la política de gratuidad o salida de beta de Flash).

*Si Google AI Studio empieza a cobrar:* El costo de Gemini Flash Image es extremadamente bajo (centavos por cada mil imágenes), así que el impacto sería mínimo comparado con Maps.

---

## 3. Cloudflare R2 (Almacenamiento y Salida)

Las imágenes originales y las ilustraciones (calculadas en unos ~500KB - 1MB combinadas por ciclo) se guardan permanentemente.

- **Storage:** 43,200 imágenes * ~1MB = ~43 GB / mes.
  - R2 regala **10 GB / mes gratis**. Excedente es de $0.015 por GB.
  - Costo Storage: 33 GB * $0.015 = **$0.49 USD / mes**.
- **Operaciones Clase A (Escritura):** 
  - R2 regala **1,000,000 Peticiones de escritura gratis**. 
  - Nosotros hacemos 86,400 (Original + Illustración) al mes.
  - Costo Escritura: **$0.00 USD / mes**.
- **Ancho de banda (Egress / Descargas):** 
  - R2 tiene **ancho de banda de salida GRATUITO** para siempre.
  - Costo Egress: **$0.00 USD / mes**.

**Total R2:** **~$0.50 USD / mes**.

---

## 4. Supabase (Database & Edge Functions)

- **Supabase Free Tier / Pro:** 
  - Supabase regala 500k invocaciones de Edge Functions al mes (estamos usando 43k).
  - La base de datos es Postgres tradicional. Almacenar 43,200 filas de texto al mes apenas consumirá un par de Megabytes, muy por debajo de los límites gratuitos de 500MB en el plan gratis o 8GB en el plan Pro de $25.
  - Costo adicional por la infraestructura de la función/DB: **$0.00 USD / mes** (todo cabe holgadamente en el tier Base/Pro que ya pagues).

---

## 🛑 CONCLUSIÓN Y RECOMENDACIÓN ESTRATÉGICA

**Costo Total Estimado 24/7 (1 minuto): ~$103.00 USD / mes**

El 99% del costo viene enteramente de robarle a Google las fotos 360 originales a través de la **Static Street View API**. 

**Estrategias para tu modelo "Solo-Preneur":**

1. **La regla de los 15 minutos:** Si cambias el `cron.schedule` en Supabase de nuevo a `*/15 * * * *` (1 vez cada 15 minutos), el volumen mensual cae a 2,880 llamadas. 
   - 2,880 * ($7.00 / 1000) = $20.16 USD. 
   - Tu crédito gratis de $200 USD lo cubre por completo sobra, haciendo que Postal Peek cueste exactamente **$0.00 USD AL MES FOREVER.**
2. **Batches de Apagado (Simular sueño):** Correr el cron a `* * * * *` (1 minuto) solo de vez en cuando para llenar la base de datos de contenido ("cazar y guardar en frío"), y luego apagar el cron (`cron.unschedule()`). Como el frontend de *La Galería* solo lee de la base de datos y de R2, tú puedes "precargar" 10,000 maravillas gratis usando tu crédito sin pasarte, y la app vivirá de esas obras guardadas eternamente en Cloudflare a costo cero.
