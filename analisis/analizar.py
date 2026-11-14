import pymannkendall as mk


def analizar(serie, desde, hasta, zona="zona", variable="NDVI"):
    """Analiza una serie mensual dentro del rango de años indicado.

    Cada elemento de serie debe incluir "fecha" (AAAA-MM) y "valor".
    """
    desde = int(desde)
    hasta = int(hasta)
    variable = variable.upper()

    if desde > hasta:
        raise ValueError("El año inicial no puede ser mayor que el año final.")

    # Recortar la serie al periodo solicitado y ordenar sus meses.
    datos = [
        dato for dato in serie
        if desde <= int(dato["fecha"][:4]) <= hasta
    ]
    datos.sort(key=lambda dato: dato["fecha"])

    # La prueba estacional debe comenzar en enero para alinear los 12 meses.
    # Si el primer año está incompleto (como TEMP_MAR en 2002), se descarta
    # hasta el primer enero disponible.
    if datos and not datos[0]["fecha"].endswith("-01"):
        primer_enero = next(
            (i for i, dato in enumerate(datos)
             if dato["fecha"].endswith("-01")),
            None,
        )
        if primer_enero is None:
            raise ValueError("No hay un enero disponible para iniciar la serie.")
        datos = datos[primer_enero:]

    if len(datos) < 24:
        raise ValueError(
            "Se necesitan al menos 24 meses para analizar dos ciclos anuales."
        )

    fechas = [dato["fecha"] for dato in datos]
    valores = [float(dato["valor"]) for dato in datos]

    # Comprobar que no haya meses faltantes ni fechas repetidas.
    for anterior, actual in zip(fechas, fechas[1:]):
        anio_ant, mes_ant = map(int, anterior.split("-"))
        anio_act, mes_act = map(int, actual.split("-"))

        mes_siguiente = mes_ant + 1
        anio_siguiente = anio_ant
        if mes_siguiente == 13:
            mes_siguiente = 1
            anio_siguiente += 1

        if (anio_act, mes_act) != (anio_siguiente, mes_siguiente):
            raise ValueError("La serie tiene meses faltantes o desordenados.")

    # Mann–Kendall estacional: los 12 meses forman un ciclo anual.
    resultado = mk.seasonal_test(valores, period=12)
    significativo = bool(resultado.h)
    p_valor = float(resultado.p)
    pendiente_anual = float(resultado.slope)
    pendiente_decada = pendiente_anual * 10

    duracion_anios = (len(valores) - 1) / 12
    cambio_total = pendiente_anual * duracion_anios
    if valores[0] == 0:
        cambio_pct = None
    else:
        cambio_pct = (cambio_total / abs(valores[0])) * 100

    tendencia = [
        float(resultado.intercept + pendiente_anual * (i / 12))
        for i in range(len(valores))
    ]

    nombres_variables = {
        "NDVI": "La vegetación",
        "LST": "La temperatura de superficie",
        "PRECIPITACION": "La precipitación",
        "TEMP_AIRE": "La temperatura del aire",
        "TEMP_MAR": "La temperatura del mar",
    }
    nombre_variable = nombres_variables.get(variable, variable)

    if significativo and pendiente_anual > 0:
        descripcion = "aumentó de forma significativa"
    elif significativo and pendiente_anual < 0:
        descripcion = "disminuyó de forma significativa"
    else:
        descripcion = "no mostró un cambio estadísticamente significativo"

    if cambio_pct is None:
        resumen = (
            f"{nombre_variable} en {zona} {descripcion} "
            f"entre {fechas[0][:4]} y {fechas[-1][:4]}."
        )
    else:
        resumen = (
            f"{nombre_variable} en {zona} {descripcion}: "
            f"{cambio_pct:+.1f}% entre {fechas[0][:4]} y {fechas[-1][:4]}."
        )

    return {
        "zona": zona,
        "variable": variable,
        "fechas": fechas,
        "valores": valores,
        "tendencia": tendencia,
        "significativo": significativo,
        "p": p_valor,
        "cambio_total": cambio_total,
        "cambio_pct": cambio_pct,
        "resumen": resumen,
        "pendiente_anual": pendiente_anual,
        "pendiente_decada": pendiente_decada,
    }