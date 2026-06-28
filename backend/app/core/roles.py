STAFF_PERFIS: set[str] = {"sede", "pastor"}
ADMIN_PERFIL = "sede"

def is_staff(perfil: str) -> bool:
    return perfil in STAFF_PERFIS

def is_admin(perfil: str) -> bool:
    return perfil == ADMIN_PERFIL
