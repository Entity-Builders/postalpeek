-- ============================================================
-- postalpeek_smart_album_rules SEED DATA
-- Pre-fills common locations, categories, and tags for a magical first experience
-- ============================================================

INSERT INTO public.postalpeek_smart_album_rules (filter_type, filter_value, creative_title)
VALUES 
    -- ====================
    -- 🌍 POPULAR COUNTRIES
    -- ====================
    ('country', 'Japan', 'Odisea en Japón 🗼'),
    ('country', 'France', 'Romance Frances 🥐'),
    ('country', 'Italy', 'Dolce Vita 🍝'),
    ('country', 'Spain', 'Tapas y Sol 🇪🇸'),
    ('country', 'United Kingdom', 'Historias Británicas ☕'),
    ('country', 'United States', 'El Sueño Americano 🗽'),
    ('country', 'Mexico', 'Colores de México 🌮'),
    ('country', 'Brazil', 'Ritmo Brasileño 🦜'),
    ('country', 'Argentina', 'Pasión Argentina 🧉'),
    ('country', 'Peru', 'Tesoros Incas 🦙'),
    ('country', 'Germany', 'Aventura en Alemania 🥨'),
    ('country', 'China', 'Maravillas de China 🐉'),
    ('country', 'Australia', 'Explorando Australia 🦘'),
    ('country', 'Canada', 'Naturaleza Canadiense 🍁'),
    ('country', 'India', 'Colores de la India 🪷'),
    ('country', 'Egypt', 'Misterios de Egipto 🐫'),
    ('country', 'Greece', 'Mitología Griega 🏛️'),
    ('country', 'Thailand', 'Paraíso Tailandés 🏝️'),

    -- ====================
    -- 🏛️ CATEGORIES
    -- ====================
    ('category', 'Architecture', 'Joyas Arquitectónicas 🏛️'),
    ('category', 'Nature', 'Respiro Natural 🌿'),
    ('category', 'Food', 'Sabores del Mundo 🍽️'),
    ('category', 'People', 'Retratos Lejanos 👥'),
    ('category', 'Animals', 'Reino Animal 🐾'),
    ('category', 'Art', 'Galería Global 🎨'),
    ('category', 'Landmarks', 'Monumentos Icónicos 🗽'),
    ('category', 'Cityscape', 'Junglas de Cemento 🏙️'),
    ('category', 'Vintage', 'Recuerdos del Pasado 🕰️'),
    ('category', 'Events', 'Momentos Únicos 🎊'),

    -- ====================
    -- 🏷️ COMMON TAGS (NATURE)
    -- ====================
    ('tag', 'cat', 'Mundo Felino 🐈'),
    ('tag', 'dog', 'Amigos Caninos 🐕'),
    ('tag', 'bird', 'Aves del Mundo 🐦'),
    ('tag', 'fish', 'Bajo el Agua 🐟'),
    ('tag', 'horse', 'Espíritu Equino 🐎'),
    ('tag', 'flower', 'Jardín Botánico 🌸'),
    ('tag', 'tree', 'Bosques Antiguos 🌳'),
    ('tag', 'mountain', 'Cumbres Majestuosas ⛰️'),
    ('tag', 'beach', 'Días de Playa 🏖️'),
    ('tag', 'river', 'Ríos Serenos 🏞️'),
    ('tag', 'lake', 'Lagos Tranquilos 💧'),
    ('tag', 'snow', 'Maravillas de Invierno ❄️'),
    ('tag', 'sunset', 'Atardeceres Mágicos 🌅'),
    ('tag', 'sunrise', 'Primeros Rayos 🌄'),
    ('tag', 'cloud', 'Cazador de Nubes ☁️'),
    ('tag', 'stars', 'Noches Estrelladas ✨'),

    -- ====================
    -- 🏷️ COMMON TAGS (URBAN & TRAVEL)
    -- ====================
    ('tag', 'car', 'Clásicos Sobre Ruedas 🚗'),
    ('tag', 'train', 'Viajes en Tren 🚂'),
    ('tag', 'plane', 'Aventuras por los Aires ✈️'),
    ('tag', 'boat', 'Travesías Marítimas ⛵'),
    ('tag', 'bicycle', 'Paseos en Bici 🚲'),
    ('tag', 'building', 'Rascacielos 🏢'),
    ('tag', 'bridge', 'Puentes del Mundo 🌉'),
    ('tag', 'street', 'Calles con Encanto 🛣️'),
    ('tag', 'church', 'Santuarios⛪'),
    ('tag', 'temple', 'Templos Sagrados ⛩️'),
    ('tag', 'castle', 'Castillos de Leyenda 🏰'),
    ('tag', 'statue', 'Esculturas Inmortales 🗽'),

    -- ====================
    -- 🏷️ COMMON TAGS (CULTURE & FOOD)
    -- ====================
    ('tag', 'coffee', 'Tiempo de Café ☕'),
    ('tag', 'tea', 'Hora del Té 🫖'),
    ('tag', 'wine', 'Vendimias 🍷'),
    ('tag', 'beer', 'Cervezas del Mundo 🍻'),
    ('tag', 'pizza', 'Amantes de la Pizza 🍕'),
    ('tag', 'dessert', 'Rincón Dulce 🍰'),
    ('tag', 'festival', 'Fiestas Tradicionales 🎭'),
    ('tag', 'music', 'Melodías Callejeras 🎸'),
    ('tag', 'dance', 'Ritmos del Mundo 💃')

ON CONFLICT (filter_type, filter_value) DO UPDATE 
SET creative_title = EXCLUDED.creative_title;
