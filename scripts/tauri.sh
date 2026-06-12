#!/usr/bin/env bash
# Wrapper around the Tauri CLI.
#
# Snap-packaged VS Code (SNAP=/snap/code/...) runs on the old core20 glibc and
# exports env vars that redirect GTK/GLib module loading into its snap tree.
# When the native Tauri binary (linked against the system glibc) initializes
# GTK from the integrated terminal, it dlopen()s those snap modules, which pull
# in core20's libpthread and crash with:
#   symbol lookup error: .../libpthread.so.0: undefined symbol:
#     __libc_pthread_init, version GLIBC_PRIVATE
#
# Stripping these vars makes GTK load the system modules instead. They are not
# needed by the Tauri CLI or the app, so this is safe for every subcommand.
exec env \
  -u GTK_PATH \
  -u GTK_EXE_PREFIX \
  -u GTK_IM_MODULE_FILE \
  -u GDK_PIXBUF_MODULE_FILE \
  -u GDK_PIXBUF_MODULEDIR \
  -u GIO_MODULE_DIR \
  -u GSETTINGS_SCHEMA_DIR \
  -u LOCPATH \
  npx tauri "$@"
