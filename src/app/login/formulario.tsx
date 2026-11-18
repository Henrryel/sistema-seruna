'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { esquemaLogin, esquemaRecuperar } from '@/esquemas/auth';
import { api, mensajeDeError } from '@/lib/api';

export function FormularioLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [modo, setModo] = useState<'login' | 'recuperar' | 'enviado'>('login');
  const form = useForm<z.infer<typeof esquemaLogin>>({ resolver: zodResolver(esquemaLogin), defaultValues: { login: '', contrasena: '' } });
  const formRec = useForm<z.infer<typeof esquemaRecuperar>>({ resolver: zodResolver(esquemaRecuperar), defaultValues: { login: '' } });

  if (modo !== 'login') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recuperar acceso</CardTitle>
          <CardDescription>
            {modo === 'enviado'
              ? 'Solicitud registrada. Secretaría le entregará un enlace para crear una nueva contraseña.'
              : 'Ingrese su usuario. El colegio le entregará un enlace de recuperación.'}
          </CardDescription>
        </CardHeader>
        {modo === 'recuperar' ? (
          <Form {...formRec}>
            <form
              onSubmit={formRec.handleSubmit(async (d) => {
                try {
                  await api.post('/api/auth/recuperar', d);
                  setModo('enviado');
                } catch (e) {
                  setError(mensajeDeError(e));
                }
              })}
            >
              <CardContent className="grid gap-4">
                <FormField
                  control={formRec.control}
                  name="login"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuario</FormLabel>
                      <FormControl>
                        <Input autoComplete="username" autoCapitalize="none" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
              </CardContent>
              <CardFooter className="mt-4 flex justify-between gap-2">
                <Button type="button" variant="ghost" onClick={() => setModo('login')}>
                  Volver
                </Button>
                <Button type="submit" disabled={formRec.formState.isSubmitting}>
                  Enviar solicitud
                </Button>
              </CardFooter>
            </form>
          </Form>
        ) : (
          <CardFooter>
            <Button className="w-full" onClick={() => setModo('login')}>
              Volver al inicio de sesión
            </Button>
          </CardFooter>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Iniciar sesión</CardTitle>
        <CardDescription>Use el usuario entregado por el colegio.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form
          noValidate
          onSubmit={form.handleSubmit(async (d) => {
            setError(null);
            try {
              await api.post('/api/auth/login', d);
              const siguiente = params.get('siguiente');
              router.push(siguiente && siguiente.startsWith('/') && !siguiente.startsWith('//') ? siguiente : '/');
              router.refresh();
            } catch (e) {
              setError(mensajeDeError(e));
            }
          })}
        >
          <CardContent className="grid gap-4">
            <FormField
              control={form.control}
              name="login"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Usuario</FormLabel>
                  <FormControl>
                    <Input autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contrasena"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error ? (
              <p role="alert" className="rounded-md bg-peligro px-3 py-2 text-sm text-peligro-foreground">
                {error}
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="mt-4 flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Ingresar
            </Button>
            <Button type="button" variant="link" size="sm" onClick={() => setModo('recuperar')}>
              ¿Olvidó su contraseña?
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
