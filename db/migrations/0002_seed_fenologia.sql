-- mantener en sincronía con src/lib/fenologia/catalogo.ts

INSERT INTO fenologia_catalogo (cultivo, mes, kc_referencia, fase, fuente, notas)
VALUES
  -- PALTO HASS
  ('palto_hass', 1,  1.00, 'desarrollo_fruto', 'FAO-56 tabla 12', 'Pleno verano. Demanda hídrica máxima. Fruto en engrose activo.'),
  ('palto_hass', 2,  1.00, 'desarrollo_fruto', 'FAO-56 tabla 12', 'Continúa engrose. Temperatura alta, ET elevada.'),
  ('palto_hass', 3,  0.95, 'maduracion',       'FAO-56 tabla 12', 'Inicio maduración. Kc baja levemente hacia otoño.'),
  ('palto_hass', 4,  0.85, 'cosecha',          'FAO-56 tabla 12', 'Cosecha principal variedades tempranas Hass. Reducir riego gradualmente.'),
  ('palto_hass', 5,  0.75, 'post_cosecha',     'INIA serie actas N°XX (estimación)', 'Post-cosecha. Recuperación foliar. Menor demanda.'),
  ('palto_hass', 6,  0.60, 'reposo',           'INIA serie actas N°XX (estimación)', 'Invierno. Crecimiento mínimo. Lluvias reducen necesidad de riego.'),
  ('palto_hass', 7,  0.55, 'reposo',           'FAO-56 tabla 12', 'Mes más frío. Kc mínimo anual. Riego de mantención solamente.'),
  ('palto_hass', 8,  0.60, 'reposo',           'INIA serie actas N°XX (estimación)', 'Fin invierno. Inicio diferenciación floral en yemas.'),
  ('palto_hass', 9,  0.70, 'brotacion',        'INIA serie actas N°XX (estimación)', 'Primavera temprana. Brotación. Kc en ascenso.'),
  ('palto_hass', 10, 0.80, 'floracion',        'FAO-56 tabla 12', 'Floración. Sensibilidad hídrica alta. Déficit afecta cuaje.'),
  ('palto_hass', 11, 0.90, 'cuaje',            'FAO-56 tabla 12', 'Cuaje y caída fisiológica. Mantener humedad uniforme.'),
  ('palto_hass', 12, 0.95, 'desarrollo_fruto', 'FAO-56 tabla 12', 'Inicio engrose rápido. Verano comenzando.'),

  -- CÍTRICOS
  ('citricos', 1,  0.80, 'desarrollo_fruto', 'FAO-56 tabla 12', 'Verano. Fruto en crecimiento. Kc sostenido.'),
  ('citricos', 2,  0.82, 'desarrollo_fruto', 'FAO-56 tabla 12', 'Pico de calor. Kc ligeramente superior por alta ET.'),
  ('citricos', 3,  0.78, 'maduracion',       'FAO-56 tabla 12', 'Otoño. Inicio maduración en naranjo tardío.'),
  ('citricos', 4,  0.72, 'cosecha',          'INIA serie actas N°XX (estimación)', 'Cosecha limonero. Naranjo aún en maduración.'),
  ('citricos', 5,  0.65, 'post_cosecha',     'INIA serie actas N°XX (estimación)', 'Post-cosecha. Inicio invierno. Lluvias complementan riego.'),
  ('citricos', 6,  0.62, 'reposo',           'FAO-56 tabla 12', 'Invierno. Cítricos perennifolios; Kc mínimo pero no cero.'),
  ('citricos', 7,  0.60, 'reposo',           'FAO-56 tabla 12', 'Mes más frío. Kc mínimo anual en cítricos.'),
  ('citricos', 8,  0.63, 'brotacion',        'INIA serie actas N°XX (estimación)', 'Inicio brotación primaveral. Kc comienza a subir.'),
  ('citricos', 9,  0.70, 'floracion',        'FAO-56 tabla 12', 'Floración. Cítricos sensibles a estrés en esta fase.'),
  ('citricos', 10, 0.75, 'cuaje',            'FAO-56 tabla 12', 'Cuaje. Mantener humedad para reducir caída fisiológica.'),
  ('citricos', 11, 0.78, 'desarrollo_fruto', 'FAO-56 tabla 12', 'Inicio engrose. Primavera avanzada.'),
  ('citricos', 12, 0.80, 'desarrollo_fruto', 'FAO-56 tabla 12', 'Pleno verano. Demanda en alza.'),

  -- CIRUELA D'AGEN
  ('ciruela_dagen', 1,  1.15, 'desarrollo_fruto', 'FAO-56 tabla 12', 'Pico verano. Kc máximo. Engrose rápido. Déficit reduce tamaño fruto.'),
  ('ciruela_dagen', 2,  1.10, 'desarrollo_fruto', 'FAO-56 tabla 12', 'Engrose final. Kc ligeramente menor al avanzar el verano.'),
  ('ciruela_dagen', 3,  1.00, 'maduracion',       'FAO-56 tabla 12', 'Maduración. Calidad se logra con riego controlado (no exceso).'),
  ('ciruela_dagen', 4,  0.85, 'cosecha',          'INIA serie actas N°XX (estimación)', 'Cosecha D''Agen. Reducir riego previo a cosecha para concentrar sólidos.'),
  ('ciruela_dagen', 5,  0.70, 'post_cosecha',     'INIA serie actas N°XX (estimación)', 'Post-cosecha otoñal. Defoliación en curso. Demanda baja.'),
  ('ciruela_dagen', 6,  0.55, 'reposo',           'FAO-56 tabla 12', 'Inicio reposo invernal. Árbol sin hojas. Lluvias sustentan.'),
  ('ciruela_dagen', 7,  0.50, 'reposo',           'FAO-56 tabla 12', 'Reposo pleno. Kc mínimo. Sin riego bajo lluvia normal Chile centro.'),
  ('ciruela_dagen', 8,  0.55, 'reposo',           'INIA serie actas N°XX (estimación)', 'Fin reposo. Inicio hinchazón yemas. Preparar sistema riego.'),
  ('ciruela_dagen', 9,  0.65, 'brotacion',        'INIA serie actas N°XX (estimación)', 'Brotación. Retomar riego. Raíces activas, hojas emergiendo.'),
  ('ciruela_dagen', 10, 0.75, 'floracion',        'FAO-56 tabla 12', 'Floración plena. Heladas tardías son el principal riesgo, no déficit.'),
  ('ciruela_dagen', 11, 0.90, 'cuaje',            'FAO-56 tabla 12', 'Cuaje y caída de frutos. Déficit agrava caída.'),
  ('ciruela_dagen', 12, 1.05, 'desarrollo_fruto', 'FAO-56 tabla 12', 'Inicio engrose rápido. Kc en ascenso hacia máximo enero.')
ON CONFLICT (cultivo, mes) DO NOTHING;
