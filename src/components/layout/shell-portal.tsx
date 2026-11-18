'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { ChevronsUpDown, GraduationCap, KeyRound, LogOut, Monitor, Moon, Repeat, Sun } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NAVEGACION, type ItemNav } from '@/config/navegacion';
import { NOMBRE_PORTAL, type Permiso, type Portal } from '@/lib/permisos';
import { api, mensajeDeError } from '@/lib/api';

export interface UsuarioShell {
  nombres: string;
  apellidos: string;
  login: string;
  permisos: Permiso[];
  portales: Portal[];
}

export interface HijoShell {
  estudianteId: string;
  nombres: string;
  apellidos: string;
}

function visible(item: ItemNav, permisos: Permiso[]) {
  return !item.permisos || item.permisos.some((p) => permisos.includes(p));
}

function activo(href: string, ruta: string, raiz: string) {
  return href === raiz ? ruta === raiz : ruta === href || ruta.startsWith(`${href}/`);
}

export function ShellPortal(props: {
  portal: Portal;
  usuario: UsuarioShell;
  hijos?: HijoShell[];
  hijoActual?: string | null;
  children: ReactNode;
}) {
  const ruta = usePathname();
  const raiz = `/${props.portal}`;
  const grupos = NAVEGACION[props.portal]
    .map((g) => ({ ...g, items: g.items.filter((i) => visible(i, props.usuario.permisos)) }))
    .filter((g) => g.items.length > 0);
  const actual = grupos.flatMap((g) => g.items).find((i) => activo(i.href, ruta, raiz));

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href={raiz}>
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <GraduationCap className="size-4" aria-hidden />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">SERUNA</span>
                    <span className="truncate text-xs text-muted-foreground">{NOMBRE_PORTAL[props.portal]}</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          {grupos.map((g) => (
            <SidebarGroup key={g.titulo}>
              <SidebarGroupLabel>{g.titulo}</SidebarGroupLabel>
              <SidebarMenu>
                {g.items.map((i) => (
                  <SidebarMenuItem key={i.href}>
                    <SidebarMenuButton asChild isActive={activo(i.href, ruta, raiz)} tooltip={i.titulo}>
                      <Link href={i.href}>
                        <i.icono aria-hidden />
                        <span>{i.titulo}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <MenuUsuario usuario={props.usuario} portal={props.portal} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-4">
          <SidebarTrigger className="-ml-1" aria-label="Mostrar u ocultar menú" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <h1 className="truncate text-sm font-medium sm:text-base">{actual?.titulo ?? NOMBRE_PORTAL[props.portal]}</h1>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {props.portal === 'padre' && props.hijos && props.hijos.length > 0 ? (
              <SelectorHijo hijos={props.hijos} actual={props.hijoActual ?? props.hijos[0]?.estudianteId ?? ''} />
            ) : null}
            {props.usuario.portales.length > 1 ? <SelectorPortal portal={props.portal} portales={props.usuario.portales} /> : null}
            <SelectorTema />
          </div>
        </header>
        <main id="contenido" className="flex-1 p-3 sm:p-6">
          {props.children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function SelectorHijo({ hijos, actual }: { hijos: HijoShell[]; actual: string }) {
  const router = useRouter();
  return (
    <Select
      value={actual}
      onValueChange={async (v) => {
        try {
          await api.post('/api/padre/hijo', { estudianteId: v });
          router.refresh();
        } catch (e) {
          toast.error(mensajeDeError(e));
        }
      }}
    >
      <SelectTrigger className="h-9 w-[150px] sm:w-[220px]" aria-label="Seleccionar hijo o hija">
        <SelectValue placeholder="Seleccione" />
      </SelectTrigger>
      <SelectContent>
        {hijos.map((h) => (
          <SelectItem key={h.estudianteId} value={h.estudianteId}>
            {h.nombres} {h.apellidos}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SelectorPortal({ portal, portales }: { portal: Portal; portales: Portal[] }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Cambiar de portal">
          <Repeat aria-hidden />
          <span className="hidden sm:inline">{NOMBRE_PORTAL[portal]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Cambiar de portal</DropdownMenuLabel>
        {portales.map((p) => (
          <DropdownMenuItem
            key={p}
            disabled={p === portal}
            onSelect={async () => {
              try {
                const r = await api.post<{ destino: string }>('/api/sesion/portal', { portal: p });
                router.push(r.destino);
                router.refresh();
              } catch (e) {
                toast.error(mensajeDeError(e));
              }
            }}
          >
            {NOMBRE_PORTAL[p]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SelectorTema() {
  const { theme, setTheme } = useTheme();
  const Icono = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Tema de color">
          <Icono aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setTheme('light')}>
          <Sun aria-hidden /> Claro
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme('dark')}>
          <Moon aria-hidden /> Oscuro
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme('system')}>
          <Monitor aria-hidden /> Sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const esquemaCambio = z
  .object({
    actual: z.string().min(1, 'Requerido'),
    nueva: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/, 'Debe incluir letras')
      .regex(/\d/, 'Debe incluir números'),
    confirmacion: z.string(),
  })
  .refine((d) => d.nueva === d.confirmacion, { message: 'No coincide', path: ['confirmacion'] });

function MenuUsuario({ usuario, portal }: { usuario: UsuarioShell; portal: Portal }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const form = useForm<z.infer<typeof esquemaCambio>>({
    resolver: zodResolver(esquemaCambio),
    defaultValues: { actual: '', nueva: '', confirmacion: '' },
  });
  const iniciales = `${usuario.nombres[0] ?? ''}${usuario.apellidos[0] ?? ''}`.toUpperCase();

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" aria-label="Menú de usuario">
                <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">{iniciales}</div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {usuario.nombres} {usuario.apellidos}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{usuario.login}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" aria-hidden />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel>{NOMBRE_PORTAL[portal]}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setAbierto(true)}>
                <KeyRound aria-hidden /> Cambiar contraseña
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async () => {
                  try {
                    await api.post('/api/auth/logout');
                  } finally {
                    router.push('/login');
                    router.refresh();
                  }
                }}
              >
                <LogOut aria-hidden /> Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
            <DialogDescription>Las demás sesiones abiertas se cerrarán.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              className="grid gap-4"
              onSubmit={form.handleSubmit(async (d) => {
                try {
                  await api.post('/api/auth/contrasena', { actual: d.actual, nueva: d.nueva });
                  toast.success('Contraseña actualizada');
                  form.reset();
                  setAbierto(false);
                } catch (e) {
                  toast.error(mensajeDeError(e));
                }
              })}
            >
              {(['actual', 'nueva', 'confirmacion'] as const).map((campo) => (
                <FormField
                  key={campo}
                  control={form.control}
                  name={campo}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{campo === 'actual' ? 'Contraseña actual' : campo === 'nueva' ? 'Nueva contraseña' : 'Confirmar nueva contraseña'}</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete={campo === 'actual' ? 'current-password' : 'new-password'} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <DialogFooter>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  Guardar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
