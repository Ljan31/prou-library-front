
/**
 * Validar nombres:
 * - Permite letras, tildes, ñ y espacios.
 * - Permite máximo 2 números.
 */
export const validarNombre = (valor: string): string => {
  let numeros = 0

  return valor
    .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s]/g, '')
    .replace(/[0-9]/g, (numero: string) => {
      numeros++
      return numeros <= 2 ? numero : ''
    })
}

/**
 * Validar apellidos:
 * - Solo permite letras, tildes, ñ y espacios.
 */
export const validarSoloLetras = (valor: string): string => {
  return valor.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '')
}

/**
 * Validar números:
 * - Solo permite dígitos.
 */
export const validarSoloNumeros = (valor: string): string => {
  return valor.replace(/[^0-9]/g, '')
}
export const validarFormatoCI = (valor: string): boolean => {
  return /^[0-9]{1,10}(-[A-Z0-9]{1,2})?$/.test(valor)
}
/**
 * - Permite números en el CI principal.
 * - Permite un complemento opcional separado por guion.
 * - El complemento admite números y letras.
 * - Máximo 10 caracteres en el CI principal.
 * - Máximo 2 caracteres en el complemento.
 */
export const validarCI = (valor: string): string => {
  // Convertir a mayúsculas y eliminar espacios
  let limpio = valor.toUpperCase().replace(/\s/g, '')

  // Permitir únicamente números, letras y guion
  limpio = limpio.replace(/[^0-9A-Z-]/g, '')

  // Separar número principal y complemento
  const guionIndex = limpio.indexOf('-')

  // Si todavía no se introduce el guion
  if (guionIndex === -1) {
    return limpio.replace(/[^0-9]/g, '').slice(0, 10)
  }

  // Número principal
  const ci = limpio
    .substring(0, guionIndex)
    .replace(/[^0-9]/g, '')
    .slice(0, 10)

  // Complemento alfanumérico
  const complemento = limpio
    .substring(guionIndex + 1)
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 2)

  return `${ci}-${complemento}`
}
