//
//  WidgetTokens.swift
//  PlandoWidget
//
//  Plando 위젯 디자인 토큰. plandoTokens.css 와 동기.
//  light/dark 양쪽 매칭. 위젯은 자체 colorScheme 으로 분기.
//

import SwiftUI

enum WidgetTokens {
    enum Brand {
        static let primary = Color(red: 0x1B / 255.0, green: 0x6F / 255.0, blue: 0xF5 / 255.0)   // #1B6FF5
        static let primarySoft = Color(red: 0x1B / 255.0, green: 0x6F / 255.0, blue: 0xF5 / 255.0).opacity(0.10)
    }

    enum Surface {
        static func bg(_ scheme: ColorScheme) -> Color {
            scheme == .dark
                ? Color(red: 0x13 / 255.0, green: 0x1B / 255.0, blue: 0x2C / 255.0)              // #131B2C
                : .white
        }
        static func card(_ scheme: ColorScheme) -> Color {
            scheme == .dark
                ? Color.white.opacity(0.04)
                : Color.black.opacity(0.025)
        }
        static func divider(_ scheme: ColorScheme) -> Color {
            scheme == .dark
                ? Color.white.opacity(0.08)
                : Color.black.opacity(0.06)
        }
    }

    enum Text {
        static func primary(_ scheme: ColorScheme) -> Color {
            scheme == .dark
                ? Color(red: 0xF8 / 255.0, green: 0xFA / 255.0, blue: 0xFC / 255.0)               // #F8FAFC
                : Color(red: 0x0F / 255.0, green: 0x17 / 255.0, blue: 0x2A / 255.0)               // #0F172A
        }
        static func secondary(_ scheme: ColorScheme) -> Color {
            scheme == .dark
                ? Color(red: 0x94 / 255.0, green: 0xA3 / 255.0, blue: 0xB8 / 255.0)               // #94A3B8
                : Color(red: 0x64 / 255.0, green: 0x74 / 255.0, blue: 0x8B / 255.0)               // #64748B
        }
        static func tertiary(_ scheme: ColorScheme) -> Color {
            scheme == .dark
                ? Color(red: 0x64 / 255.0, green: 0x74 / 255.0, blue: 0x8B / 255.0)
                : Color(red: 0x94 / 255.0, green: 0xA3 / 255.0, blue: 0xB8 / 255.0)
        }
    }

    enum Status {
        static let high   = Color(red: 0xE1 / 255.0, green: 0x1D / 255.0, blue: 0x48 / 255.0)    // #E11D48
        static let medium = Color(red: 0xF5 / 255.0, green: 0x9E / 255.0, blue: 0x0B / 255.0)    // #F59E0B
        static let low    = Color(red: 0x94 / 255.0, green: 0xA3 / 255.0, blue: 0xB8 / 255.0)    // #94A3B8
        static let done   = Color(red: 0x10 / 255.0, green: 0xB9 / 255.0, blue: 0x81 / 255.0)    // #10B981
    }

    enum Radius {
        static let card: CGFloat = 22
        static let chip: CGFloat = 8
        static let pill: CGFloat = 999
    }

    /// 달력(주간/월간) 위젯 전용 톤 — WidgetPreview.jsx 의 tokens() 와 동기.
    enum CalendarTone {
        /// today/＋ 강조 — 라이트(Apple 그린) / 다크(Plando 블루)
        static func accent(_ s: ColorScheme) -> Color {
            s == .dark ? Color(hex: 0x2F7BFF) : Color(hex: 0x34C759)
        }
        static func sun(_ s: ColorScheme) -> Color {
            s == .dark ? Color(hex: 0xFF7A7A) : Color(hex: 0xFF453A)
        }
        static func sat(_ s: ColorScheme) -> Color {
            s == .dark ? Color(hex: 0x7FB0FF) : Color(hex: 0x2F6BFF)
        }
        static func overflow(_ s: ColorScheme) -> Color {
            s == .dark ? Color(hex: 0x7A7A84) : Color(hex: 0x8A8A90)
        }
        static func track(_ s: ColorScheme) -> Color {
            s == .dark ? Color.white.opacity(0.10) : Color.black.opacity(0.07)
        }

        /// 6종 카테고리 색 (work·meet·meal·fit·hobby·etc).
        /// 미리보기 catOf 와 동일 규칙: index = (projectId ?? id) % 6.
        static func category(projectId: Int?, id: Int, scheme: ColorScheme) -> (bg: Color, text: Color) {
            let base = projectId ?? id
            let idx = ((base % 6) + 6) % 6
            if scheme == .dark {
                switch idx {
                case 0: return (Color(hex: 0x2F7BFF, alpha: 0.28), Color(hex: 0x9CC0FF)) // work
                case 1: return (Color(hex: 0x7C3AED, alpha: 0.30), Color(hex: 0xC4A8FF)) // meet
                case 2: return (Color(hex: 0xEA7317, alpha: 0.30), Color(hex: 0xFFC48F)) // meal
                case 3: return (Color(hex: 0x16A34A, alpha: 0.30), Color(hex: 0x84E8AA)) // fit
                case 4: return (Color(hex: 0xDB2777, alpha: 0.30), Color(hex: 0xFF9FCB)) // hobby
                default: return (Color(hex: 0x0D9488, alpha: 0.30), Color(hex: 0x74DED4)) // etc
                }
            } else {
                switch idx {
                case 0: return (Color(hex: 0x2563EB, alpha: 0.16), Color(hex: 0x1D4ED8)) // work
                case 1: return (Color(hex: 0x7C3AED, alpha: 0.16), Color(hex: 0x6D28D9)) // meet
                case 2: return (Color(hex: 0xEA7317, alpha: 0.18), Color(hex: 0xC2570A)) // meal
                case 3: return (Color(hex: 0x16A34A, alpha: 0.16), Color(hex: 0x15803D)) // fit
                case 4: return (Color(hex: 0xDB2777, alpha: 0.16), Color(hex: 0xBE185D)) // hobby
                default: return (Color(hex: 0x0D9488, alpha: 0.16), Color(hex: 0x0F766E)) // etc
                }
            }
        }
    }
}

extension Color {
    /// 0xRRGGBB hex + optional alpha. 위젯 토큰 정의 간결화용.
    init(hex: UInt32, alpha: Double = 1) {
        let r = Double((hex >> 16) & 0xFF) / 255.0
        let g = Double((hex >> 8) & 0xFF) / 255.0
        let b = Double(hex & 0xFF) / 255.0
        self.init(.sRGB, red: r, green: g, blue: b, opacity: alpha)
    }
}
