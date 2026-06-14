describe('Core CityBeat Flows', () => {
  it('loads the homepage in English', () => {
    cy.visit('/en')
    cy.get('h1').should('contain', 'Local')
  })

  it('loads the homepage in Spanish', () => {
    cy.visit('/es')
    cy.get('h1').should('contain', 'Local')
  })

  it('can type into newsletter form', () => {
    cy.visit('/en')
    cy.get('input[type="email"]').type('test@example.com')
    cy.get('button').contains('Join').should('be.visible')
  })
})
