import Foundation

/// 하루치 플레이리스트에 올라온 트랙 한 곡.
struct PlaylistTrack: Identifiable, Hashable {
    let id: String
    /// 이 곡을 올린 멤버.
    let member: PlaylistMember
    let title: String
    let artist: String
    /// 곡과 함께 남긴 한 줄 코멘트.
    let comment: String
    /// 카드 배경으로 깔리는 앨범 아트. 비어 있으면 단색으로 채운다.
    let albumArtName: String?

    init(
        id: String = UUID().uuidString,
        member: PlaylistMember,
        title: String,
        artist: String,
        comment: String,
        albumArtName: String? = nil
    ) {
        self.id = id
        self.member = member
        self.title = title
        self.artist = artist
        self.comment = comment
        self.albumArtName = albumArtName
    }
}

/// 트랙 카드와 곡 추가 카드에 공통으로 들어가는 멤버 표시 정보.
struct PlaylistMember: Identifiable, Hashable {
    let id: String
    let name: String
    /// 에셋 카탈로그 이름. 비어 있으면 플레이스홀더 원을 그린다.
    let imageName: String?

    init(id: String = UUID().uuidString, name: String, imageName: String? = nil) {
        self.id = id
        self.name = name
        self.imageName = imageName
    }
}

extension PlaylistTrack {
    /// Firestore 연동 전까지 화면을 채우는 시안 데이터.
    static let samples: [PlaylistTrack] = [
        PlaylistTrack(
            id: "t1",
            member: PlaylistMember(id: "m1", name: "보규"),
            title: "1-4-3",
            artist: "Yerin Baek",
            comment: "1-4-3의 의미는 I LOVE YOU"
        ),
        PlaylistTrack(
            id: "t2",
            member: PlaylistMember(id: "m2", name: "승완"),
            title: "Different Summer",
            artist: "pH-1",
            comment: "널 달래듯이 지는 석양을 봐"
        )
    ]
}
