import XCTest

/// 온보딩에서 팀 카드를 누르면 그 팀의 플레이리스트 화면으로 넘어가는지 확인한다.
final class OnboardingNavigationUITests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func test_팀카드를_누르면_플레이리스트_화면으로_이동한다() throws {
        let app = XCUIApplication()
        app.launch()

        let teamCard = app.buttons.containing(.staticText, identifier: "무직은 내 삶").firstMatch
        XCTAssertTrue(teamCard.waitForExistence(timeout: 5), "온보딩에 팀 카드가 보여야 한다")

        teamCard.tap()

        let playlistTitle = app.staticTexts["🎵 무직은 내 삶"]
        XCTAssertTrue(playlistTitle.waitForExistence(timeout: 5), "플레이리스트 헤더에 팀 이름이 보여야 한다")
        XCTAssertTrue(app.staticTexts["1-4-3"].exists, "트랙 카드가 보여야 한다")
        XCTAssertTrue(app.buttons["+ 곡 추가하기"].exists, "곡 추가 카드가 보여야 한다")
    }

    @MainActor
    func test_플레이리스트에서_뒤로가면_온보딩으로_돌아온다() throws {
        let app = XCUIApplication()
        app.launch()

        app.buttons.containing(.staticText, identifier: "무직은 내 삶").firstMatch.tap()

        let backButton = app.buttons.matching(identifier: "chevron.left").firstMatch
        XCTAssertTrue(backButton.waitForExistence(timeout: 5), "헤더에 뒤로 가기 버튼이 있어야 한다")

        backButton.tap()

        XCTAssertTrue(
            app.staticTexts["참여 중인 팀"].waitForExistence(timeout: 5),
            "온보딩 화면으로 돌아와야 한다"
        )
    }
}
