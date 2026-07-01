# Clima local

Obtén el clima actual usando wttr.in. Acepta una ciudad como argumento; si no se proporciona, usa Colima.

## Instrucciones

1. Lee el argumento `$ARGUMENTS` para saber qué ciudad consultar. Si está vacío, usa `Colima`.
2. Ejecuta el siguiente comando con Bash (reemplaza `{CIUDAD}` con el valor del argumento, usando guiones bajos en lugar de espacios):

```bash
curl -s "wttr.in/{CIUDAD}?format=v2&lang=es"
```

3. Muestra el resultado formateado en la respuesta. Si el usuario pidió más detalle o un reporte completo, usa:

```bash
curl -s "wttr.in/{CIUDAD}?lang=es"
```

4. Si el comando falla o la ciudad no se encuentra, informa al usuario e invítalo a intentar con otro nombre de ciudad.

## Ejemplos de uso

- `/clima` — clima de Colima
- `/clima Guadalajara` — clima de Guadalajara
- `/clima New York` — clima de Nueva York
- `/clima London` — clima de Londres
