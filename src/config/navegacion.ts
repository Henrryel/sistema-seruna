import {
  BadgeDollarSign,
  BookOpenCheck,
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Clock,
  CreditCard,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  GraduationCap,
  HandCoins,
  History,
  IdCard,
  LayoutDashboard,
  Layers,
  ListChecks,
  Medal,
  NotebookPen,
  QrCode,
  Receipt,
  ScanLine,
  School,
  ShieldCheck,
  SquareUserRound,
  TableProperties,
  Timer,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Permiso, Portal } from '@/lib/permisos';

export interface ItemNav {
  titulo: string;
  href: string;
  icono: LucideIcon;
  /** Visible si el usuario tiene ALGUNO de estos permisos (solo portal admin). */
  permisos?: readonly Permiso[];
}

export interface GrupoNav {
  titulo: string;
  items: ItemNav[];
}

// Mapa completo de pantallas. Cada módulo implementa las rutas que le corresponden.
export const NAVEGACION: Record<Portal, GrupoNav[]> = {
  admin: [
    {
      titulo: 'General',
      items: [{ titulo: 'Panel', href: '/admin', icono: LayoutDashboard }],
    },
    {
      titulo: 'Identidad',
      items: [
        { titulo: 'Personas', href: '/admin/personas', icono: SquareUserRound, permisos: ['usuarios.gestionar', 'matriculas.gestionar'] },
        { titulo: 'Usuarios y accesos', href: '/admin/usuarios', icono: UserCog, permisos: ['usuarios.gestionar'] },
        { titulo: 'Bitácora', href: '/admin/bitacora', icono: History, permisos: ['usuarios.gestionar'] },
      ],
    },
    {
      titulo: 'Estructura académica',
      items: [
        { titulo: 'Años y bimestres', href: '/admin/academico/anios', icono: CalendarRange, permisos: ['academico.configurar'] },
        { titulo: 'Calendario escolar', href: '/admin/academico/calendario', icono: CalendarDays, permisos: ['academico.configurar'] },
        { titulo: 'Secciones y aulas', href: '/admin/academico/secciones', icono: School, permisos: ['academico.configurar'] },
        { titulo: 'Currículo CNEB', href: '/admin/academico/curriculo', icono: BookOpenCheck, permisos: ['academico.configurar'] },
        { titulo: 'Planes de estudio', href: '/admin/academico/planes', icono: Layers, permisos: ['academico.configurar'] },
        { titulo: 'Cursos y docentes', href: '/admin/academico/asignaciones', icono: ClipboardList, permisos: ['academico.configurar'] },
        { titulo: 'Horarios y sesiones', href: '/admin/academico/horarios', icono: Clock, permisos: ['academico.configurar'] },
      ],
    },
    {
      titulo: 'Matrícula',
      items: [
        { titulo: 'Estudiantes', href: '/admin/matricula/estudiantes', icono: GraduationCap, permisos: ['matriculas.gestionar'] },
        { titulo: 'Matrículas', href: '/admin/matricula/matriculas', icono: ClipboardCheck, permisos: ['matriculas.gestionar'] },
        { titulo: 'Reglas y requisitos', href: '/admin/matricula/reglas', icono: ListChecks, permisos: ['matriculas.gestionar'] },
        { titulo: 'Expedientes', href: '/admin/matricula/expedientes', icono: FolderArchive, permisos: ['expediente.gestionar'] },
        { titulo: 'Documentos institucionales', href: '/admin/matricula/documentos', icono: FileText, permisos: ['matriculas.gestionar'] },
      ],
    },
    {
      titulo: 'Evaluación',
      items: [
        { titulo: 'Calificaciones', href: '/admin/evaluacion/calificaciones', icono: NotebookPen, permisos: ['academico.calificar', 'academico.publicar'] },
        { titulo: 'Cierres de bimestre', href: '/admin/evaluacion/cierres', icono: ClipboardCheck, permisos: ['academico.publicar'] },
        { titulo: 'Reglas de evaluación', href: '/admin/evaluacion/reglas', icono: ShieldCheck, permisos: ['academico.configurar_cierre_anual'] },
        { titulo: 'Cierre anual', href: '/admin/evaluacion/cierre-anual', icono: BookOpenCheck, permisos: ['academico.cerrar_anio'] },
        { titulo: 'Recuperación', href: '/admin/evaluacion/recuperacion', icono: History, permisos: ['academico.recuperacion'] },
        { titulo: 'Orden de mérito', href: '/admin/evaluacion/merito', icono: Medal, permisos: ['academico.publicar_merito'] },
        { titulo: 'Exportación SIAGIE', href: '/admin/evaluacion/siagie', icono: FileSpreadsheet, permisos: ['academico.exportar_siagie'] },
        { titulo: 'Libretas', href: '/admin/evaluacion/libretas', icono: FileText, permisos: ['reportes.academico', 'academico.publicar'] },
      ],
    },
    {
      titulo: 'Asistencia',
      items: [
        { titulo: 'Asistencia diaria', href: '/admin/asistencia/diaria', icono: ClipboardList, permisos: ['asistencia.registrar'] },
        { titulo: 'Justificaciones', href: '/admin/asistencia/justificaciones', icono: ClipboardCheck, permisos: ['asistencia.resolver'] },
        { titulo: 'Políticas y jornadas', href: '/admin/asistencia/jornadas', icono: CalendarDays, permisos: ['asistencia.configurar'] },
        { titulo: 'Credenciales y carnets', href: '/admin/asistencia/credenciales', icono: IdCard, permisos: ['asistencia.configurar'] },
        { titulo: 'Lectores QR', href: '/admin/asistencia/lectores', icono: QrCode, permisos: ['asistencia.configurar'] },
        { titulo: 'Escáner de puerta', href: '/escaner', icono: ScanLine, permisos: ['asistencia.marcar'] },
      ],
    },
    {
      titulo: 'Cobros',
      items: [
        { titulo: 'Caja', href: '/admin/cobros/caja', icono: Wallet, permisos: ['tesoreria.cobrar'] },
        { titulo: 'Cobrar', href: '/admin/cobros/cobrar', icono: HandCoins, permisos: ['tesoreria.cobrar'] },
        { titulo: 'Pagos y recibos', href: '/admin/cobros/pagos', icono: Receipt, permisos: ['tesoreria.cobrar', 'tesoreria.revertir'] },
        { titulo: 'Cuotas', href: '/admin/cobros/cuotas', icono: CreditCard, permisos: ['tesoreria.cobrar'] },
        { titulo: 'Planes de cobro', href: '/admin/cobros/planes', icono: TableProperties, permisos: ['tesoreria.cobrar'] },
        { titulo: 'Morosidad y recaudación', href: '/admin/cobros/reportes', icono: BadgeDollarSign, permisos: ['reportes.tesoreria'] },
      ],
    },
    {
      titulo: 'Personal y planilla',
      items: [
        { titulo: 'Docentes y contratos', href: '/admin/planilla/contratos', icono: Users, permisos: ['planilla.contratos'] },
        { titulo: 'Horas docentes', href: '/admin/planilla/horas', icono: Timer, permisos: ['planilla.horas', 'planilla.aprobar_horas'] },
        { titulo: 'Liquidaciones', href: '/admin/planilla/liquidaciones', icono: FileSpreadsheet, permisos: ['planilla.liquidar', 'planilla.pagar'] },
      ],
    },
    {
      titulo: 'Documentos y reportes',
      items: [
        { titulo: 'Reportes', href: '/admin/reportes/documentos', icono: FileText, permisos: ['reportes.matriculas', 'reportes.tesoreria', 'reportes.academico', 'reportes.asistencia', 'reportes.dashboard'] },
        { titulo: 'Plantillas', href: '/admin/reportes/plantillas', icono: Building2, permisos: ['reportes.configurar'] },
        { titulo: 'Comunicaciones', href: '/admin/reportes/comunicaciones', icono: FileText, permisos: ['matriculas.gestionar', 'reportes.configurar'] },
        { titulo: 'Importación histórica', href: '/admin/reportes/importacion', icono: FolderArchive, permisos: ['datos.conciliar_historico'] },
      ],
    },
  ],
  docente: [
    {
      titulo: 'Docente',
      items: [
        { titulo: 'Inicio', href: '/docente', icono: LayoutDashboard },
        { titulo: 'Mis cursos', href: '/docente/cursos', icono: ClipboardList },
        { titulo: 'Calificaciones', href: '/docente/calificaciones', icono: NotebookPen },
        { titulo: 'Asistencia', href: '/docente/asistencia', icono: ClipboardCheck },
        { titulo: 'Horario', href: '/docente/horario', icono: Clock },
        { titulo: 'Mi asistencia', href: '/docente/mi-asistencia', icono: CalendarDays },
        { titulo: 'Mi planilla', href: '/docente/planilla', icono: Wallet },
      ],
    },
  ],
  estudiante: [
    {
      titulo: 'Estudiante',
      items: [
        { titulo: 'Inicio', href: '/estudiante', icono: LayoutDashboard },
        { titulo: 'Mis logros', href: '/estudiante/notas', icono: Medal },
        { titulo: 'Asistencia', href: '/estudiante/asistencia', icono: CalendarDays },
        { titulo: 'Horario', href: '/estudiante/horario', icono: Clock },
        { titulo: 'Pagos', href: '/estudiante/pagos', icono: Receipt },
      ],
    },
  ],
  padre: [
    {
      titulo: 'Familia',
      items: [
        { titulo: 'Resumen', href: '/padre', icono: LayoutDashboard },
        { titulo: 'Logros', href: '/padre/notas', icono: Medal },
        { titulo: 'Asistencia', href: '/padre/asistencia', icono: CalendarDays },
        { titulo: 'Justificaciones', href: '/padre/justificaciones', icono: ClipboardCheck },
        { titulo: 'Horario', href: '/padre/horario', icono: Clock },
        { titulo: 'Pagos', href: '/padre/pagos', icono: Receipt },
      ],
    },
  ],
};
