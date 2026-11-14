import pymannkendall  as mk

def analizar(serie, desde, hasta,
              zona="zona", variable="NDVI"):
    """
    Analiza una serie mensual dentro
    del rango de años indicado.

    serie: lista de objetos con "fecha" (AAAA-MM) y "valor".
    desde, hasta: años incluidos 
    en el análisis.
    zona y variable: se añadirán a 
    la respuesta que consume la web.
    """

    desde = int(desde)
    hasta = int(hasta)
    variable = variable.upper()

    # Seleccionar los registros cuyos años estén dentro del rango.
    datos = [
       dato for dato in serie
        if desde <= int(dato["fecha"][:4]) <= hasta
    ]

    #Ordenarlos cronológicamente por fecha.
    datos.sort(key=lambda dato:
               dato["fecha"])

    if len(datos) < 24:
        raise ValueError(
            "Se necesita al menos" \
        "24 meses para analizar dos ciclos" \
        " anuales."
        )
    fechas = [dato["fecha"] for dato in datos]
    valores = [float(dato["valor"]) for dato in datos]


    #La prueba espera meses consecutivos y que la serie empiece en enero.
    if not fechas[0].endswith("-01"):
        raise ValueError("La serie filtrada debe comenzar en enero.")

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

      # Mann–Kendall estacional: 12 meses forman un ciclo anual.
      
        resultado = mk.seasonal_test(valores, period=12)
        significativo = bool(resultado.h)
        p_valor = float(resultado.p)

      # La pendiente estacional se expresa por año.

        pendiente_anual = float(resultado.slope)
        pendiente_decada = pendiente_anual * 10

       # Tiempo entre el primer y el último dato, expresado en años.
        duración_anios = (len(valores) -1) / 12
        cambio_total = pendiente_anual * duración_anios

       # Porcentaje respecto al valor inicial; no se calcula si empieza en cero.

        if valores[0] == 0:
            cambio_pct = None
        else:
            cambio_pct = (cambio_total / abs(valores[0])) * 100

        # Línea de tendencia para la gráfica.
        tendencia = [
            float(resultado.intercept + pendiente_anual * (i / 12))
                for i in range(len(valores))
        ]

        nombre_variable = {
            "NDVI":"La vegetación",
            "LST":"La temperatura de superficie",
           }.get(variable, variable)

        if significativo and pendiente_anual > 0:
            descripcion = "aumentó de forma significativa"
        elif significativo and pendiente_anual < 0:
            descripcion = "disminuyó de forma significativa"
        else: 
            descripcion = "no mostró un cambio estadísticamente significativo"
        if cambio_pct is None:
                resumen = ( f"{nombre_variable} en {zona} {descripcion} " 
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
                    "pendiente_decada": pendiente_decada
                   } 