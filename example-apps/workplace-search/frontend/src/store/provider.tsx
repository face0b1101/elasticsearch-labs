import type { TypedUseSelectorHook } from 'react-redux'
import { Provider, useDispatch, useSelector } from 'react-redux'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import { configureStore, createSlice } from '@reduxjs/toolkit'
import { SourceType, ChatMessageType } from 'types'

type GlobalStateType = {
  status: AppStatus
  conversation: ChatMessageType[]
  sources: SourceType[]
  sessionId: string | null
}

class RetriableError extends Error {}
class FatalError extends Error {}
export enum AppStatus {
  Idle = 'idle',
  StreamingMessage = 'loading',
  Done = 'done',
  Error = 'error',
}
enum STREAMING_EVENTS {
  SESSION_ID = '[SESSION_ID]',
  SOURCE = '[SOURCE]',
  DONE = '[DONE]',
}

const GLOBAL_STATE: GlobalStateType = {
  status: AppStatus.Idle,
  conversation: [],
  sessionId: null,
  sources: [],
}
const API_HOST = 'http://localhost:3001/api'

let abortController: AbortController | null = null
const globalSlice = createSlice({
  name: 'global',
  initialState: GLOBAL_STATE as GlobalStateType,
  reducers: {
    addSource: (state, action) => {
      const source = action.payload.source
      const rootSource = state.sources.find((s) => s.name === source.name)

      if (rootSource) {
        rootSource.summary = [...rootSource.summary, source.summary]
      } else {
        state.sources.push({ ...source, summary: [source.summary] })
      }
    },
    setStatus: (state, action) => {
      state.status = action.payload.status
    },
    setSessionId: (state, action) => {
      state.sessionId = action.payload.sessionId
    },
    addMessage: (state, action) => {
      state.conversation.push(action.payload.conversation)
    },
    updateMessage: (state, action) => {
      const messageIndex = state.conversation.findIndex(
        (c) => c.id === action.payload.id
      )

      if (messageIndex !== -1) {
        state.conversation[messageIndex] = {
          ...state.conversation[messageIndex],
          ...action.payload,
        }
      }
    },
    setMessageSource: (state, action) => {
      const message = state.conversation.find((c) => c.id === action.payload.id)

      if (message) {
        message.sources = action.payload.sources
          .map((sourceName) =>
            state.sources.find((stateSource) => stateSource.name === sourceName)
          )
          .filter((source) => !!source)
      }
    },
    removeMessage: (state, action) => {
      const messageIndex = state.conversation.findIndex(
        (c) => c.id === action.payload.id
      )

      if (messageIndex !== -1) {
        state.conversation.splice(messageIndex, 1)
      }
    },
    sourceToggle: (state, action) => {
      const source = state.sources.find((s) => s.name === action.payload.name)

      if (source) {
        source.expanded = action.payload.expanded ?? !source.expanded
      }
    },
    reset: (state) => {
      state.status = AppStatus.Idle
      state.sessionId = null
      state.conversation = []
      state.sources = []
    },
  },
})

const store = configureStore({
  reducer: globalSlice.reducer,
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
export const actions = globalSlice.actions

export const thunkActions = {
  search: (query: string) => {
    return async function fetchSearch(dispatch, getState) {
      if (getState().status === AppStatus.StreamingMessage) {
        dispatch(thunkActions.abortRequest())
      }

      dispatch(actions.reset())
      dispatch(thunkActions.chat(query))
    }
  },
  askQuestion: (question: string) => {
    return async function (dispatch, getState) {
      const state = getState()

      dispatch(
        actions.addMessage({
          conversation: {
            isHuman: true,
            content: question,
            id: state.conversation.length + 1,
          },
        })
      )
      dispatch(thunkActions.chat(question))
    }
  },
  chat: (question: string) => {
    return async function fetchSearch(dispatch, getState) {
      abortController = new AbortController()
      const conversationId = getState().conversation.length + 1

      dispatch(
        actions.addMessage({
          conversation: {
            isHuman: false,
            content: '',
            id: conversationId,
          },
        })
      )
      dispatch(actions.setStatus({ status: AppStatus.StreamingMessage }))

      let countRetiresError = 0
      let message = ''
      const sessionId = getState().sessionId
      const sourcesMap: Map<
        string,
        { name: string; url?: string; summary: string[] }
      > = new Map()

      await fetchEventSource(
        `${API_HOST}/chat${sessionId ? `?session_id=${sessionId}` : ''}`,
        {
          method: 'POST',
          openWhenHidden: true,
          body: JSON.stringify({
            question,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
          signal: abortController.signal,
          async onmessage(event) {
            if (event.event === 'FatalError') {
              throw new FatalError(event.data)
            }

            if (event.data.startsWith(STREAMING_EVENTS.SESSION_ID)) {
              const sessionId = event.data.split(' ')[1].trim()
              dispatch(actions.setSessionId({ sessionId }))
            } else if (event.data.startsWith(STREAMING_EVENTS.SOURCE)) {
              const source = event.data.replace(
                `${STREAMING_EVENTS.SOURCE} `,
                ''
              )

              try {
                if (source) {
                  const parsedSource: {
                    name: string
                    page_content: string
                    url?: string
                    icon?: string
                    updated_at?: string | null
                  } = JSON.parse(source.replaceAll('\n', ''))

                  if (parsedSource.page_content && parsedSource.name) {
                    dispatch(
                      actions.addSource({
                        source: {
                          name: parsedSource.name,
                          url: parsedSource.url,
                          summary: parsedSource.page_content,
                          icon: parsedSource.icon,
                          updated_at: parsedSource.updated_at,
                        },
                      })
                    )
                  }
                }
              } catch (e) {
                console.log('error', source, event.data)
                console.error(e)
              }
            } else if (event.data === STREAMING_EVENTS.DONE) {
              parseSources(message, (sources) => {
                dispatch(
                  actions.setMessageSource({
                    id: conversationId,
                    sources,
                  })
                )
              })
              dispatch(actions.setStatus({ status: AppStatus.Done }))
            } else {
              message += message && event.data === '' ? '\n' : event.data

              dispatch(
                actions.updateMessage({
                  id: conversationId,
                  content: message,
                })
              )
            }
          },
          async onopen(response) {
            if (response.ok) {
              return
            } else if (
              response.status >= 400 &&
              response.status < 500 &&
              response.status !== 429
            ) {
              throw new FatalError()
            } else {
              throw new RetriableError()
            }
          },
          onerror(err) {
            if (err instanceof FatalError || countRetiresError > 3) {
              dispatch(actions.setStatus({ status: AppStatus.Error }))

              throw err
            } else {
              countRetiresError++
              console.error(err)
            }
          },
        }
      )
    }
  },
  abortRequest: () => {
    return function (dispatch, getState) {
      const messages = getState().conversation
      const lastMessage = messages[getState().conversation.length - 1]

      abortController?.abort()
      abortController = null

      if (!lastMessage.content) {
        dispatch(
          actions.removeMessage({
            id: lastMessage.id,
          })
        )
      }
      dispatch(
        actions.setStatus({
          status: messages.length ? AppStatus.Done : AppStatus.Idle,
        })
      )
    }
  },
}

const parseSources = (
  message: string,
  callback: (sources: string[]) => void
) => {
  const html = document.createElement('html')
  html.innerHTML = message

  try {
    const script = html.querySelector<HTMLElement>('script')
    if (script) {
      const sources = JSON.parse(script?.innerText)

      if (sources.length) {
        callback(sources)
      }
    }
  } catch (e) {
    console.error(e)
  }
}

export const GlobalStateProvider = ({ children }) => {
  return <Provider store={store}>{children}</Provider>
}
