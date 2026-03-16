# PRD: PostalPeek Collectibles — "Figuritas del Mundo"

**Version**: 0.1.0 — Draft  
**Last Updated**: 2026-03-15  
**Status**: Draft  
**Owner**: Juan O.  
**Platform**: Web (Vite + React), future: iOS/Android  

---

## 1. Product Overview

### 1.1 Vision Statement

Transformar PostalPeek de una galería pasiva de postales generadas por Walker en un **juego de colección tipo figuritas** donde cada postal es un activo digital único que pertenece al primer usuario que la reclama. Los usuarios compiten sanamente por completar álbumes temáticos, intercambian postales entre sí, y descubren el mundo a través de la mirada de Walker.

> **En una frase:** "Postcrossing meets Pokémon — pero las figuritas las genera una IA caminando por el mundo."

### 1.2 Target Audience

**Primary:** Jóvenes 18-35 con interés en viajes, cultura urbana y coleccionismo digital (fans de Pokémon GO, Geocaching, stickers de WhatsApp).  
**Secondary:** Negocios locales que quieren visibilidad orgánica a través de postales patrocinadas con cupones de descuento.

### 1.3 Success Metrics

| Metric | Target (3 meses post-launch) |
|---|---|
| DAU / MAU ratio | > 25% |
| Postales reclamadas por día | > 500 |
| Álbumes completados | > 50 |
| D7 Retention (collectors) | > 40% |
| Intercambios exitosos | > 100 totales |

---

## 2. Competitive Context

### 2.1 Landscape

| App | Modelo | Fortaleza | Debilidad | Oportunidad para PostalPeek |
|---|---|---|---|---|
| **Postcrossing** | Mail físico entre extraños | Enorme comunidad global | Sin gamificación, sin digital | Colección digital + desafíos |
| **Munzee** | QR codes + scavenger hunt | Gamificación sólida (puntos, badges) | Requiere deployar QR físicos | Walker genera contenido automáticamente |
| **Geocaching Treasures** | Colección digital post-hallazgo | Integrado en ecosistema enorme | Solo coleccionables genéricos | Postales visualmente ricas + AI |
| **Pokémon TCG Pocket** | Card game con colección | UX de colección 10/10 | Ficción, no mundo real | Postales basadas en lugares reales |

### 2.2 Diferenciación Clave

1. **Contenido generado autónomamente por Walker** — No requiere acciones del usuario para crear, a diferencia de Munzee o Geocaching.
2. **Cada postal es un lugar real del mundo** — No es ficción, son fachadas, murales, estadios reales.
3. **Escasez natural** — Solo 1 dueño por postal. First come, first served.
4. **Álbumes temáticos curados por Walker** — Los desafíos se generan a partir de lo que Walker va encontrando.

---

## 3. Core Mechanics

### 3.1 Ownership ("Adueñarse")

```
POSTAL LIBRE → User toca "Reclamar" → POSTAL ADQUIRIDA (owner_id = user)
                                       → Ya nadie más puede reclamarla
```

- Cada postal de `postalpeek_postcards` tiene un `owner_id` (nullable).
- Cuando `owner_id IS NULL`, la postal está disponible para ser reclamada.
- Una vez reclamada, la postal aparece en la **Colección** del usuario.
- El botón actual de ❤️ (favorito) se reemplaza/complementa con la mecánica de "Reclamar".

### 3.2 Límites Diarios/Mensuales

| Tier | Reclamos/día | Reclamos/mes | Precio |
|---|---|---|---|
| **Free** | 10 | 200 | Gratis |
| **Collector** | 30 | 800 | $2.99/mes |
| **Explorer** | Ilimitados | Ilimitados | $7.99/mes |

> [!NOTE]
> Estos valores son iniciales. Se ajustarán con data real post-launch.

- Un contador de reclamos se resetea a medianoche (UTC del usuario).
- Cuando el user alcanza el límite diario → modal "Querés coleccionar más hoy?" con upgrade path.

### 3.3 Álbumes / Desafíos

Un álbum es una colección temática con un set predefinido de "slots" que el usuario debe completar reclamando postales que coincidan.

**Ejemplos:**
- 🏟️ "Estadios de Capital Federal" — 12 slots (Monumental, Bombonera, Cilindro...)
- 🎨 "Street Art de Palermo" — 20 slots
- ☕ "Cafés Notables de Buenos Aires" — 15 slots
- 🌎 "Vuelta al Mundo" — 1 postal de cada país que Walker visitó

**Generación de álbumes:**
- Walker genera álbumes basándose en los trips que recorre y las categorías que encuentra.
- Un álbum puede tener un mixto de postales ya existentes (reclamables) y futuras (irán apareciendo).
- Completar un álbum → **Badge de colección** + posible recompensa (días extra de reclamos, etc.)

### 3.4 Intercambio (Trading)

```
User A tiene postal X, necesita postal Y
User B tiene postal Y, necesita postal X
→ Propuesta de intercambio → Aceptar/Rechazar → Swap de owner_id
```

- **Solo 1:1** (una postal por otra) para simplificar el MVP.
- El intercambio se propone desde la vista de "Mi Colección" o desde el perfil público de otro usuario.
- Historial de intercambios visible en el perfil.

### 3.5 Postales Sponsor (Monetización B2B)

Walker pasa por un negocio → genera postal con la fachada → la postal tiene un tag `is_sponsored = true` y un `coupon_data JSONB` adjunto.

- El user que la reclama recibe el beneficio del cupón.
- El cupón se muestra al dar vuelta la postal (ya existe `PostcardCoupon.tsx`).
- El negocio paga por: visibilidad + engagement + conversión.

### 3.6 Reclamo Verificado (Bonus opcional)

El dorso de cada postal muestra la **source image** de Walker (Street View). Un user puede opcionalmente subir su propia foto del mismo lugar para **verificar** que estuvo ahí.

```
Postal reclamada (normal) → User sube foto del lugar
                           → AI compara con source image (similarity score)
                           → Score > threshold → ✅ Badge "Verificado"
                           → La foto del user reemplaza la source image en el dorso
```

**Beneficios del reclamo verificado:**
- 🏅 Badge "Verificado" visible en la postal
- ⭐ Mayor valor en intercambios (postales verificadas son más deseables)
- 📸 La foto del user personaliza la postal — ahora es *su* postal del Monumental
- 🎯 Bonus: completar un álbum con todas las postales verificadas → badge especial "Explorador"

> [!NOTE]
> El reclamo verificado es **100% opcional**. El user puede reclamar cualquier postal con un tap. La verificación es un bonus para quienes visitan los lugares.

---

## 4. Data Model (Cambios sobre el actual)

### 4.1 Modificaciones a `postalpeek_postcards`

```sql
ALTER TABLE postalpeek_postcards ADD COLUMN owner_id UUID REFERENCES auth.users(id);
ALTER TABLE postalpeek_postcards ADD COLUMN claimed_at TIMESTAMPTZ;
ALTER TABLE postalpeek_postcards ADD COLUMN is_sponsored BOOLEAN DEFAULT false;
ALTER TABLE postalpeek_postcards ADD COLUMN coupon_data JSONB;
ALTER TABLE postalpeek_postcards ADD COLUMN rarity TEXT DEFAULT 'common' 
  CHECK (rarity IN ('common', 'rare', 'epic', 'legendary'));
ALTER TABLE postalpeek_postcards ADD COLUMN is_verified BOOLEAN DEFAULT false;
ALTER TABLE postalpeek_postcards ADD COLUMN verification_image_url TEXT;
ALTER TABLE postalpeek_postcards ADD COLUMN verified_at TIMESTAMPTZ;
```

### 4.2 Nuevas Tablas

```sql
-- Álbumes temáticos
CREATE TABLE postalpeek_albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  category TEXT NOT NULL, -- 'stadiums', 'street_art', 'cafes', etc.
  country TEXT,
  city TEXT,
  total_slots INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Slots del álbum (qué postales lo completan)
CREATE TABLE postalpeek_album_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID REFERENCES postalpeek_albums(id) ON DELETE CASCADE,
  postcard_id UUID REFERENCES postalpeek_postcards(id), -- nullable (slot futuro)
  slot_label TEXT NOT NULL, -- "Estadio Monumental", "Café Tortoni"
  slot_order INT NOT NULL,
  UNIQUE (album_id, slot_order)
);

-- Progreso del usuario en un álbum
CREATE TABLE postalpeek_album_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  album_id UUID REFERENCES postalpeek_albums(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ, -- null = in progress
  UNIQUE (user_id, album_id)
);

-- Intercambios
CREATE TABLE postalpeek_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_id UUID REFERENCES auth.users(id),
  receiver_id UUID REFERENCES auth.users(id),
  offered_postcard_id UUID REFERENCES postalpeek_postcards(id),
  requested_postcard_id UUID REFERENCES postalpeek_postcards(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Límites de reclamo
CREATE TABLE postalpeek_claim_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'collector', 'explorer')),
  daily_claims_used INT DEFAULT 0,
  monthly_claims_used INT DEFAULT 0,
  last_daily_reset DATE DEFAULT CURRENT_DATE,
  last_monthly_reset DATE DEFAULT date_trunc('month', CURRENT_DATE)::date
);
```

### 4.3 Relación con sistema actual

- `postalpeek_favorites` **se mantiene** — un usuario puede "favoritear" una postal sin reclamarla (como un wishlist).
- `postalpeek_shares` **se mantiene** — compartir un link a una postal sigue funcionando igual.
- La tabla `postalpeek_postcards` evoluciona para soportar ownership sin romper el feed existente.

---

## 5. User Flows

### 5.1 Reclamar una Postal

1. User navega el feed de Walker (no cambia)
2. Ve una postal que le gusta
3. En lugar de ❤️, ve un botón **"🃏 Reclamar"** (si `owner_id IS NULL`)
4. Toca "Reclamar" → animación de "figurita pegada" → la postal ahora tiene su avatar
5. Si ya tiene dueño → muestra "Adquirida por @username" con opción de proponer intercambio.

### 5.2 Ver Mi Colección

1. User toca su avatar / "Mi Colección" en el nav
2. Ve un grid de todas sus postales organizadas por país/categoría
3. Puede filtrar por álbum y ver progreso (12/20 completas)
4. Las postales que le faltan para un álbum aparecen como siluetas

### 5.3 Proponer un Intercambio

1. User ve una postal que necesita → está adquirida por @otrouser
2. Toca "Proponer intercambio"
3. Se abre selector de "¿Qué ofrecés?" con sus propias postales
4. Selecciona una → se envía propuesta
5. @otrouser recibe notificación → acepta o rechaza
6. Si acepta → swap automático de `owner_id`

### 5.4 Verificar una Postal (Opcional)

1. User tiene una postal reclamada → toca "Verificar" en el dorso
2. Se abre la cámara / selector de fotos
3. Sube una foto del lugar → AI compara con la source image de Walker
4. Si match > threshold → badge "✅ Verificado" + su foto reemplaza la source image
5. Si no matchea → "Hmm, no parece ser el mismo lugar. Intentá de nuevo"

### 5.5 Completar un Álbum

1. User reclama la última postal que le faltaba para un álbum
2. Animación especial 🎉 → Badge desbloqueado
3. El álbum aparece como "Completo" con efecto dorado
4. +5 reclamos extra de bonus

---

## 6. Phasing (Fases de Implementación)

### Phase 1 — MVP: Ownership + Colección (2-3 semanas)
- [ ] Agregar `owner_id` / `claimed_at` a postcards
- [ ] Botón "Reclamar" en el feed
- [ ] Vista "Mi Colección" básica (grid)
- [ ] Límites diarios (hardcoded free tier)
- [ ] Migración de favoritos → ownership (opt-in)

### Phase 2 — Álbumes + Desafíos + Verificación (2-3 semanas)
- [ ] Tablas de álbumes y slots
- [ ] Vista de álbumes con progreso
- [ ] Walker genera álbumes automáticamente
- [ ] Badges por completar álbumes
- [ ] Reclamo Verificado: upload de foto + AI similarity check
- [ ] Badge "Verificado" en postal + foto del user en el dorso

### Phase 3 — Trading (2 semanas)
- [ ] Sistema de propuestas de intercambio
- [ ] Notificaciones (email o in-app)
- [ ] Historial de trades

### Phase 4 — Monetización (1-2 semanas)
- [ ] Tiers de suscripción (Stripe via `eb-packages`)
- [ ] Postales sponsor con cupones
- [ ] UI de upgrade cuando el user alcanza límite

---

## 7. Decisions (Resolved)

| # | Pregunta | Decisión |
|---|---|---|
| 1 | ¿Favoritos existentes? | **Opción B** — Favoritos se mantienen como wishlist separada. Ownership es una mecánica distinta. |
| 2 | ¿Sistema de rareza? | **Sí** — `common`, `rare`, `epic`, `legendary`. Walker asigna rareza según contexto (hora, evento, lugar icónico). |
| 3 | ¿Perfil público? | **Sí** — Cada user tiene un perfil público con su colección visible. Necesario para trading. |
| 4 | ¿Álbumes globales o personales? | **Globales**, creados y curados por Walker. |
| 5 | ¿Nombre de la feature? | **TBD** — Candidatos: "Collectibles", "PostalPeek Collection". Se define antes de Phase 1. |

---

## 8. References

- [Postcrossing](https://www.postcrossing.com) — Modelo de intercambio de postales físicas
- [Munzee](https://www.munzee.com) — Gamificación location-based con QR codes
- [Geocaching Treasures](https://www.geocaching.com) — Digital collectibles por hallazgos
- [Pokémon TCG Pocket](https://tcgpocket.pokemon.com) — UX de colección de cartas digital

---

**Document History**:

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-03-15 | Juan O. (via Antigravity) | Initial PRD draft |
| 0.2.0 | 2026-03-15 | Juan O. (via Antigravity) | Added Verified Claims mechanic, resolved open questions |
