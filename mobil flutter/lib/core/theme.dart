import 'package:flutter/material.dart';

const Color kPrimary = Color(0xFF10b981);
const Color kPrimaryDark = Color(0xFF059669);
const Color kBackground = Color(0xFF09090b);
const Color kSurface = Color(0xFF18181b);
const Color kSurface2 = Color(0xFF27272a);
const Color kBorder = Color(0xFF3f3f46);
const Color kTextPrimary = Color(0xFFffffff);
const Color kTextSecondary = Color(0xFFa1a1aa);
const Color kTextMuted = Color(0xFF71717a);
const Color kPrimaryFaded = Color(0xFF052e16);

ThemeData buildTheme() {
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: kBackground,
    colorScheme: const ColorScheme.dark(
      primary: kPrimary,
      secondary: kPrimary,
      surface: kSurface,
      background: kBackground,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: kBackground,
      elevation: 0,
      titleTextStyle: TextStyle(color: kTextPrimary, fontSize: 18, fontWeight: FontWeight.w800),
      iconTheme: IconThemeData(color: kTextPrimary),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: kSurface,
      selectedItemColor: kPrimary,
      unselectedItemColor: kTextMuted,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: kSurface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: kSurface2),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: kSurface2),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: kPrimary),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: kPrimary,
        foregroundColor: kBackground,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        minimumSize: const Size(double.infinity, 56),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
      ),
    ),
  );
}
