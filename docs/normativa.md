# Normativa de evaluación por competencias (CNEB) — qué codifica SERUNA

> **Advertencia.** Este documento NO transcribe normas. Indica qué normas se tomaron como referencia, qué reglas
> impone la base de datos `excelencia_seruna` (verificadas leyendo sus funciones, triggers y CHECK) y qué decide la
> aplicación. Todo lo marcado con **[VERIFICAR]** debe contrastarse con el texto oficial vigente publicado por el
> MINEDU (diario oficial *El Peruano* / gob.pe) antes de usarse en producción. No se citan artículos ni cifras que
> no hayan sido verificados.

## 1. Normas referidas

| Norma | Uso en SERUNA | Estado |
|---|---|---|
| RVM N.° 094-2020-MINEDU (norma de evaluación de competencias de la Educación Básica) | Marco de la escala AD/A/B/C, conclusiones descriptivas, situación final, recuperación. | **[VERIFICAR]** texto vigente y modificatorias. |
| RVM N.° 048-2024-MINEDU | Referida en el encargo como norma que actualiza disposiciones de evaluación. | **[VERIFICAR]** qué artículos de la RVM 094-2020 modifica y desde qué año escolar rige. |
| RM N.° 556-2024-MINEDU | Referida en el encargo (orientaciones para el año escolar). | **[VERIFICAR]** alcance en evaluación y si existe una norma equivalente para el año escolar en curso. |

Las reglas de evaluación se registran en `reglas_evaluacion.referencia_normativa` (texto libre obligatorio) y pueden
llevar el PDF oficial como evidencia (`evidencia_id`). Así cada cierre anual queda ligado a la versión exacta de la
regla con que se aprobó.

## 2. Reglas que impone la base (no se duplican en la app)

| Regla | Dónde vive |
|---|---|
| Escala de niveles de logro `AD`, `A`, `B`, `C`. | CHECK en `calificaciones_competencia`, `resultados_anuales_competencia`, `evaluaciones_recuperacion`. |
| Estados de una calificación: `pendiente`, `no_desarrollada`, `evaluada`; nivel solo si está evaluada; conclusión solo si está evaluada. | CHECK de `calificaciones_competencia`. |
| Cuatro bimestres por año (número 1–4, sin solapes). | CHECK/EXCLUDE de `bimestres`; `controlar_cierre_anual` exige los 4. |
| La nota solo se registra si la matrícula estuvo en la sección del cierre, con ese plan, durante el bimestre. | `validar_calificacion`. |
| Rectificar una nota exige **motivo** y el cierre en **borrador**; queda historial (anterior/nueva, autor, motivo). Las notas no se borran. | `validar_calificacion`, `registrar_revision_calificacion`, `conservar_calificacion`. |
| Cierre por sección y bimestre: `borrador → cerrado → publicado`; reabrir vuelve a borrador (se audita). | `validar_cierre_evaluacion` y CHECK de `cierres_evaluacion`. |
| Para cerrar/publicar: sin notas pendientes, **conclusión descriptiva obligatoria en C (todos los niveles) y en B en Primaria**, y todas las competencias del plan para toda la nómina al fin del bimestre. | `validar_cierre_evaluacion`. **[VERIFICAR]** que coincida con la RVM 048-2024. |
| Situación final: `promovido`, `recuperacion`, `permanencia`. | CHECK de `cierres_anuales`. |
| Cierre anual versionado: v1 `ordinario`; luego `rectificacion` o `recuperacion` sobre el cierre aprobado anterior; fecha de corte = fin del 4.º bimestre; matrícula confirmada en sección y plan al corte; bimestres cursados publicados; resultados de todas las competencias del plan; coherencia con los últimos logros publicados; aprobado = inmutable. | `controlar_cierre_anual`, `controlar_resultado_anual`, vista `ultimos_logros_publicados`. |
| Recuperación / subsanación solo sobre competencias pendientes de un cierre aprobado y con fecha ≥ corte; borrador → aprobada sin cambios; no se borra. | `controlar_evaluacion_recuperacion`. |
| Reglas de evaluación versionadas; aprobada = inmutable. | `proteger_regla_evaluacion`. |
| Orden de mérito: solo Secundaria, con regla aprobada; alcance `grado` o `secundaria_completa` (este solo en 5.º); puestos consecutivos desde 1; calificativo entre 2.5 y 10; cada puesto apunta a un cierre lectivo aprobado (no de recuperación); publicado = inmutable. **La base no lo calcula**: exige archivo y referencia del listado oficial de SIAGIE. | `controlar_publicacion_merito`, `controlar_puesto_merito`, CHECK de `orden_merito`. **[VERIFICAR]** origen de la escala 2.5–10 y criterios de desempate (docs/db/discrepancias.md, punto 17). |
| Exportación SIAGIE: bimestre publicado, todas las competencias `reportable_siagie` mapeadas y código SIAGIE de cada estudiante; contenido con huella SHA-256 de la plantilla. | `preparar_exportacion_siagie`, CHECK de `mapeos_siagie`. |

## 3. Lo que decide la aplicación

1. **Situación final sugerida.** La base valida la coherencia del cierre anual pero no decide la situación
   (discrepancias, punto 18). La app aplica los `criterios` de la última regla **aprobada** del año y grado y guarda la
   sugerencia en el borrador; quien aprueba puede elegir otra situación con sustento. Las competencias pendientes de
   recuperación se marcan según los criterios (o manualmente en el borrador).
2. **Alcance docente.** El docente solo ve y califica los cursos donde tiene una asignación que se cruza con el
   bimestre, y solo las competencias que su asignatura califica en el plan (`asignatura_competencias`).
3. **Ventana de registro.** Si el bimestre define `registro_inicio`/`registro_fin`, el docente solo guarda dentro de
   ella (la administración no tiene esa restricción).
4. **Aviso temprano.** La grilla avisa antes de guardar qué conclusiones serán obligatorias para cerrar (C, y B en
   Primaria); la validación real la hace la base al cerrar.

## 4. Esquema de `reglas_evaluacion.criterios` (`seruna/criterios-evaluacion@1`)

Definido y validado con Zod en `src/esquemas/evaluacion/criterios.ts` (el mismo esquema en cliente y servidor).

```jsonc
{
  "esquema": "seruna/criterios-evaluacion@1",
  "descripcion": "texto libre (opcional)",
  "areasExcluidas": ["CODIGO_AREA"],          // áreas que no cuentan (p. ej. talleres) — por código de área
  "reglas": [                                  // se evalúan EN ORDEN; la primera que se cumple fija la situación
    {
      "situacion": "permanencia" | "recuperacion" | "promovido",
      "descripcion": "texto que verá quien aprueba",
      "combinar": "todas" | "alguna",          // cómo se combinan las condiciones (por defecto "todas")
      "condiciones": [
        {
          "ambito": "competencias" | "areas",
          "niveles": ["C"],                     // niveles anuales que se cuentan
          "comparador": "al_menos" | "mas_de" | "como_maximo" | "menos_de",
          "cantidad": 1,                        // umbral absoluto…
          "proporcion": 0.5,                    // …o relativo al total (0..1). Exactamente uno de los dos.
          "umbralArea": { "comparador": "al_menos" | "mas_de", "proporcion": 0.5 } // obligatorio si ambito = "areas":
                                                // un área cuenta si la fracción de SUS competencias en `niveles` lo cumple
        }
      ]
    }
  ],
  "situacionPorDefecto": "promovido",          // si ninguna regla se cumple
  "recuperacion": {
    "nivelesPendientes": ["C"],                // competencias que quedan pendientes cuando la situación es "recuperacion"
    "situacionSiPersiste": "permanencia"       // sugerencia en la etapa de recuperación si los criterios vuelven a dar "recuperacion"
  }
}
```

Algoritmo (`evaluarCriterios`): se toman los niveles anuales de las competencias del plan (excluyendo
`areasExcluidas`); para cada regla se cuentan competencias (o áreas) en los niveles indicados y se comparan con el
umbral; la primera regla que se cumple da la situación. En la etapa de recuperación, los resultados toman el nivel de la
última evaluación de recuperación aprobada (o el anterior si no la hay) y se vuelve a evaluar.

La pantalla de reglas ofrece una plantilla **ilustrativa** (`CRITERIOS_EJEMPLO`: permanencia si hay 4 o más áreas con
C en más de la mitad de sus competencias; recuperación si hay al menos una C). **Esos umbrales son solo un ejemplo de
forma, no la norma.** **[VERIFICAR]** y transcribir, por nivel, ciclo y grado, las condiciones oficiales de:

- promoción (incluido si algún grado tiene promoción automática),
- recuperación pedagógica / evaluación de subsanación y cuántas competencias o áreas la permiten,
- permanencia en el grado,
- situación tras la recuperación (`situacionSiPersiste`),
- tratamiento de competencias transversales y de talleres (`areasExcluidas`).

## 5. Exportación al Excel oficial de SIAGIE (convención de la app)

- Columnas en numeración Excel desde 1 (A = 1). El nivel de logro va en `columna_nl` (par, ≥ 4: D, F, H…) y la
  conclusión en la columna siguiente (la base exige `columna_conclusion = columna_nl + 1`).
- La fila de cada estudiante se ubica buscando su `codigo_siagie` en las columnas A … (menor columna NL de la hoja − 1).
  Los códigos se comparan sin espacios y sin ceros a la izquierda (Excel suele guardarlos como número).
- `codigo_excel` debe aparecer en la columna NL por encima de la primera fila de estudiantes; si no aparece se genera
  una advertencia (no bloquea).
- Competencia "no desarrollada": ambas celdas quedan vacías. **[VERIFICAR]** cómo la registra SIAGIE.
- Se escribe sobre la misma plantilla subida (se comprueba su SHA-256 con el que registró la base). ExcelJS conserva
  valores y estilos; **[VERIFICAR]** con una carga real que SIAGIE acepte el archivo (macros, validaciones o celdas
  protegidas podrían no conservarse).
- **[VERIFICAR]** la estructura real de la plantilla del año vigente (hoja, ubicación del código del estudiante y de
  los códigos de competencia).

## 6. Pendientes de verificación (resumen)

1. Texto vigente de RVM 094-2020-MINEDU y de sus modificatorias (RVM 048-2024-MINEDU) y alcance de RM 556-2024-MINEDU
   para el año escolar en curso.
2. Umbrales oficiales de promoción, recuperación y permanencia por nivel/ciclo/grado → transcribirlos en cada regla.
3. Obligatoriedad de la conclusión descriptiva por nivel de logro y nivel educativo (la base exige C siempre y B en Primaria).
4. Escala 2.5–10 y criterios de desempate del orden de mérito.
5. Formato y aceptación de la plantilla SIAGIE generada.
