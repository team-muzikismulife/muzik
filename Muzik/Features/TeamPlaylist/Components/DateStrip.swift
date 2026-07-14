import SwiftUI

/// 좌우 화살표로 주 단위를 넘기고, 그 주의 날짜 칩을 가로로 훑는 막대.
struct DateStrip: View {
    @Binding var selectedDate: Date
    /// 0이면 이번 주, -1이면 지난주. 화살표로만 움직인다.
    @State private var weekOffset = 0

    private let calendar = Calendar.current

    var body: some View {
        HStack(spacing: MuzikSpacing.s) {
            arrow(systemName: "chevron.left") { weekOffset -= 1 }

            ScrollView(.horizontal) {
                HStack(spacing: MuzikSpacing.s) {
                    ForEach(visibleDates, id: \.self) { date in
                        dateChip(for: date)
                    }
                }
            }
            .scrollIndicators(.hidden)

            arrow(systemName: "chevron.right") { weekOffset += 1 }
        }
        .padding(.horizontal, MuzikSpacing.lg)
        .padding(.vertical, MuzikSpacing.xl)
    }

    private func dateChip(for date: Date) -> some View {
        let isSelected = calendar.isDate(date, inSameDayAs: selectedDate)

        return Button {
            selectedDate = date
        } label: {
            Text(Self.chipFormatter.string(from: date))
                .muzikStyle(MuzikFont.dateChip)
                .foregroundStyle(isSelected ? MuzikColor.chipSelectedText : MuzikColor.textMuted)
                .padding(.horizontal, MuzikSpacing.md)
                .padding(.vertical, 6)
        }
        .buttonStyle(.plain)
        .background(isSelected ? MuzikColor.chipSelectedBackground : MuzikColor.chipBackground)
        .clipShape(Capsule())
    }

    private func arrow(systemName: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(MuzikColor.textPrimary)
                .frame(width: MuzikSize.icon, height: MuzikSize.icon)
        }
        .buttonStyle(.plain)
    }

    /// `weekOffset`이 가리키는 주의 7일.
    private var visibleDates: [Date] {
        let today = calendar.startOfDay(for: .now)
        guard
            let anchor = calendar.date(byAdding: .weekOfYear, value: weekOffset, to: today),
            let week = calendar.dateInterval(of: .weekOfYear, for: anchor)
        else {
            return [today]
        }

        return (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: week.start) }
    }

    private static let chipFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M/d"
        return formatter
    }()
}

#Preview {
    @Previewable @State var selected = Date()

    DateStrip(selectedDate: $selected)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(MuzikColor.background)
}
