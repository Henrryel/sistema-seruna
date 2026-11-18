'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { esquemaNuevaContrasena } from '@/esquemas/auth';
import { api, mensajeDeError } from '@/lib/api';

export function FormularioAcceso(props: { token: string; nombre: string; login: string; titulo: string }) {
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof esquemaNuevaContrasena>>({
    resolver: zodResolver(esquemaNuevaContrasena),
    defaultValues: { contrasena: '', confirmacion: '' },
  });

  if (listo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>¡Listo!</CardTitle>
          <CardDescription>
            Su contraseña fue registrada. Ingrese con el usuario <strong>{props.login}</strong>.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/login">Iniciar sesión</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.titulo}</CardTitle>
        <CardDescription>
          Hola, {props.nombre}. Su usuario es <strong>{props.login}</strong>. Cree una contraseña de al menos 8 caracteres con
          letras y números.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(async (d) => {
            setError(null);
            try {
              await api.post('/api/auth/acceso', { token: props.token, contrasena: d.contrasena });
              setListo(true);
            } catch (e) {
              setError(mensajeDeError(e));
            }
          })}
        >
          <CardContent className="grid gap-4">
            <input type="text" name="username" autoComplete="username" value={props.login} readOnly hidden />
            <FormField
              control={form.control}
              name="contrasena"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nueva contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmacion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          </CardContent>
          <CardFooter className="mt-4">
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              Guardar contraseña
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
