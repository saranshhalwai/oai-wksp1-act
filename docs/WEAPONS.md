# Workshop weapons

| Weapon | Projectiles / behavior | Explosion radius | Max points | Crater radius |
|---|---|---:|---:|---:|
| Standard Shell | One shell | 36 | 40 | 30 |
| Heavy Shell | One shell, same speed rule | 54 | 65 | 48 |
| Scatter Volley | Three angles: −6°, 0°, +6° | 24 each | 18 each | 20 each |
| Airburst Cluster | Apex splits once into five | 22 each | 16 each | 18 each |
| Borer Shell | Radius-6 tunnel, ≤60 units | 34 | 35 | 30 |

Scatter offsets clamp to 0–180°; one volley uses one ammunition item. Cluster children inherit parent vx plus −90/−45/0/45/90 and have downward vy=40. If the unsplit parent hits first, it detonates once with radius 24, max 20 and crater 20. There is no recursive splitting. Borer's first tank contact detonates immediately; terrain contact begins the bounded timed drill phase. Unique explosion IDs prevent double scoring.

Metadata is public in `WEAPONS`. Handler implementation and official shot solving remain server-only. Participants cannot register new runtime handlers.
