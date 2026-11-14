// SONDA BUG-012 / BUG-034: the most common Spanish slips in user-visible text (words without their accent and
// voseo instead of tuteo) fail the test run. Only the text people read is checked: HTML text and readable
// attributes, and string literals in TypeScript (not identifiers, imports, comments nor specs).
//
// Run: node scripts/check-spanish-copy.mjs   (also part of `npm test`)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app');

/** Wrong form -> right form. Only words that are never correct without the accent in this app. */
const WRONG = {
  atencion: 'atención', sesion: 'sesión', accion: 'acción', informacion: 'información', conexion: 'conexión',
  pagina: 'página', paginas: 'páginas', telefono: 'teléfono', telefonos: 'teléfonos', resena: 'reseña', resenas: 'reseñas',
  miercoles: 'miércoles', sabado: 'sábado', sabados: 'sábados', dia: 'día', dias: 'días', manana: 'mañana',
  proxima: 'próxima', proximas: 'próximas', proximo: 'próximo', proximos: 'próximos', titulo: 'título',
  subtitulo: 'subtítulo', categoria: 'categoría', categorias: 'categorías', gestion: 'gestión',
  notificacion: 'notificación', todavia: 'todavía', codigo: 'código', direccion: 'dirección', contrasena: 'contraseña',
  duracion: 'duración', ultimos: 'últimos', ultimas: 'últimas', electronico: 'electrónico', rapido: 'rápido',
  configuracion: 'configuración', edicion: 'edición', ubicacion: 'ubicación', tamano: 'tamaño', maximo: 'máximo',
  minimo: 'mínimo', imagenes: 'imágenes', seccion: 'sección', aplicacion: 'aplicación', barberia: 'barbería',
  podras: 'podrás', expiro: 'expiró', invalido: 'inválido', especificos: 'específicos', exito: 'éxito',
  busqueda: 'búsqueda', descripcion: 'descripción', despues: 'después', tambien: 'también', membresia: 'membresía',
  membresias: 'membresías', contrasenas: 'contraseñas', publicos: 'públicos', ano: 'año', anos: 'años',
};

/** Voseo (the app speaks in tuteo): wrong form -> tuteo. */
const VOSEO = {
  'tenés': 'tienes', 'tenes': 'tienes', 'podés': 'puedes', 'podes': 'puedes', 'querés': 'quieres', 'sabés': 'sabes',
  'elegí': 'elige', 'seleccioná': 'selecciona', 'eliminá': 'elimina', 'llevá': 'lleva', 'ingresá': 'ingresa',
  'revisá': 'revisa', 'hacé': 'haz', 'escribí': 'escribe', 'tocá': 'toca', 'probá': 'prueba', 'recordá': 'recuerda',
  'confirmá': 'confirma', 'cambiá': 'cambia', 'agregá': 'agrega', 'guardá': 'guarda', 'intentá': 'intenta',
  'mirá': 'mira', 'esperá': 'espera', 'completá': 'completa', 'registrate': 'regístrate', 'contanos': 'cuéntanos',
  'escribinos': 'escríbenos', 'querés recargar': 'quieres recargar',
};

const ALL = { ...WRONG, ...VOSEO };
const pattern = new RegExp(`(?<![\\p{L}\\p{N}_\\-./#])(${Object.keys(ALL).join('|')})(?![\\p{L}\\p{N}_\\-/(])`, 'giu');

export function readableText(file, content) {
  if (file.endsWith('.html')) {
    return content
      .replace(/<!--[^]*?-->/g, ' ')
      .replace(/<[^>]*>/g, (tag) =>
        ` ${[...tag.matchAll(/(?:placeholder|title|aria-label|alt|label|message|confirmLabel)="([^"]*)"/g)].map((m) => m[1]).join(' ')} `)
      .replace(/\{\{([^]*?)\}\}/g, (_, expression) =>
        ` ${[...expression.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]).join(' ')} `)
      .replace(/@\w+\s*\([^)]*\)/g, ' ');
  }
  return [...content
    .replace(/\/\*[^]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/(from\s+|import\(\s*)(['"])[^'"]*\2/g, ' ')
    .matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)]
    .map((m) => m[1] ?? m[2] ?? m[3] ?? '')
    // A lower-case slug ('resenas', 'customer-reviews') is an id or a key, not text.
    .filter((text) => !/^[a-z0-9-]+$/.test(text))
    .join('\n');
}

export function findSlips(file, content) {
  const slips = [];
  readableText(file, content).split('\n').forEach((line) => {
    for (const match of line.matchAll(pattern)) {
      slips.push({ word: match[1], fix: ALL[match[1].toLowerCase()] });
    }
  });
  return slips;
}

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(html|ts)$/.test(name) && !name.endsWith('.spec.ts') ? [full] : [];
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const problems = files(root).flatMap((file) =>
    findSlips(file, readFileSync(file, 'utf8')).map(({ word, fix }) => `${relative(root, file)}: «${word}» → «${fix}»`));

  if (problems.length > 0) {
    console.error(`Textos en español a corregir (${problems.length}):\n${problems.join('\n')}`);
    process.exit(1);
  }
  console.log('check-spanish-copy: sin faltas de tildes ni voseo en los textos.');
}
