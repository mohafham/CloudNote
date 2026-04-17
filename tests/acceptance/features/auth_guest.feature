Feature: Authentication and guest access
  As a visitor
  I want to authenticate or enter guest mode
  So that I can use the app with correct cloud entitlements

  Scenario: Register and login successfully
    Given I am on the authentication screen
    When I submit valid registration data
    Then my account should be created
    And I should receive access and refresh tokens
    When I submit valid login credentials
    Then I should be logged in

  Scenario: Guest mode warning and limits
    Given I am on the authentication screen
    When I select Continue as Guest
    Then I should see "You will not receive cloud benefits."
    And cloud sync endpoints should be unavailable for my session
