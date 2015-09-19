import React from 'react'
import Bacon from 'baconjs'
import inBrowser from './inBrowser'
import request from 'superagent-bluebird-promise'

const showMovies = applicationState =>
    <ul className="movies">
    {
        applicationState.movies.map((movie, key) =>
            <li className="movies__movie" key={key}>
                <div className="movies__movie__image-container">
                    <img src={movie.imageUrl}/>
                </div>
                <div className="movies__movie__details">
                    <h2>{movie.title}</h2>
                    <h3>{movie.startTime}</h3>
                    <input
                        type="number"
                        placeholder="Number of tickets"
                        value={applicationState.bookings[movie.id] || undefined}
                        onChange={evt => amountOfTicketsInput.push({movieId: movie.id, textInput: evt.target.value}) }
                        />
                    <button
                        onClick={() => bookingButtonClickedBus.push()}
                        disabled={!applicationState.bookings[movie.id]}>
                        Book now
                    </button>
                </div>
            </li>
        )
    }
    </ul>

const showBookings = applicationState =>
    <div>
        <h2>Your bookings</h2>
        <ul>
        {
            applicationState
                .movies
                .filter(({id}) => Object.keys(applicationState.bookings).indexOf(id) > -1)
                .map((bookedMovie, key) =>
                    <li key={key}>
                        <h3>{bookedMovie.title}, {bookedMovie.startTime}</h3>
                        <div>{applicationState.bookings[bookedMovie.id]} tickets</div>
                    </li>
                )
        }
        </ul>
    </div>

export const renderPage = applicationState =>
    <body>
        <h1 className="page-title">{pageTitle}</h1>
        {(() => {
            switch (true) {
                case '/' == applicationState.url:
                    return showMovies(applicationState)
                case new RegExp('/user/.*/bookings').test(applicationState.url):
                    return showBookings(applicationState)
                default:
                    return `Could not find a route for ${applicationState.url}`
            }
        })()}
    </body>

export const pagePath = new RegExp("((^\/$|^\/user/.*))")

export const findUserId = url => {
    const userIdFromUrl = url.match("/user/(.*?)/")
    return userIdFromUrl ? userIdFromUrl[1] : undefined
}

export const initialState = (movies, url, bookings = {}) => ({
    movies,
    url,
    bookings
})

export const pageTitle = 'Book movie tickets'

const userId = () => {
    const localStorageKey = 'bookingAppUserId'
    const storedUserId = localStorage.getItem(localStorageKey)
    if (storedUserId) {
        return storedUserId
    } else {
        const generatedUserId = Math.random().toString()
        localStorage.setItem(localStorageKey, generatedUserId)
        return generatedUserId
    }
}

const bookingButtonClickedBus = new Bacon.Bus()
const urlStream = Bacon.mergeAll(
    bookingButtonClickedBus.map(() => `/user/${userId()}/bookings`).doAction(url => history.pushState({}, '', url)),
    inBrowser ?
        Bacon
            .fromBinder(sink => { window.onpopstate = sink })
            .map(() => document.location.pathname)
        :
        Bacon.never()
)

const amountOfTicketsInput = new Bacon.Bus()
const bookingsStream = amountOfTicketsInput
    .filter(({textInput}) => /\d+/.test(textInput) || textInput === "")
    .map(({movieId, textInput}) => ({
        movieId, amountOfTickets: textInput.length == 0 ? 0 : parseInt(textInput)
    }))
    .flatMap(({movieId, amountOfTickets}) =>
        Bacon
            .fromPromise(request.put(
                `/api/users/${userId()}/bookings/${movieId}?amountOfTickets=${amountOfTickets}`
            ))
            .map(({movieId, amountOfTickets}))
    )

export const applicationStateProperty = initialState => Bacon.update(
    initialState,
    bookingsStream, (applicationState, {movieId, amountOfTickets}) => {
        const previousBookings = applicationState.bookings
        const nextBookings = {...previousBookings, [movieId]: amountOfTickets}
        return { ...applicationState, bookings: nextBookings}
    },
    urlStream, (applicationState, url) => ({...applicationState, url})
).doLog('application state')