import React, { useState } from "react";
import ChatInput from "./components/chat/input";

import { ChatMessageList } from "./components/chat_message_list";
import { Summary } from "./components/summary";
import SearchInput from "./components/chat/search_input";
import {
  thunkActions,
  useAppDispatch,
  useAppSelector,
} from "./store/provider";
import { cn } from "./lib/utils";
import { BeatLoader } from "react-spinners";
import { Header } from "./components/header";
import { SourceIcon } from "./components/source_icon";

function Results() {
  const conversation = useAppSelector((state) => state.conversation);
  const dispatch = useAppDispatch();

  const onSubmit = (query) => {
    dispatch(thunkActions.askQuestion(query));
  };

  const [summary, ...chatMessages] = conversation;

  return (
    <>
      <div className="max-w-2xl mx-auto relative">
        <div className="bg-white shadow-xl mt-4 p-6 rounded-xl border border-light-fog mb-8">
          <div className="mb-4">
            <Summary
              isLoading={summary?.loading}
              text={summary?.content}
              sources={summary?.sources || []}
            />
          </div>

          <div
            className={cn("chat border-t border-fog", {
              "border-0": chatMessages.length === 0,
            })}
          >
            <div className="chat__messages">
              <ChatMessageList
                messages={chatMessages}
              />
            </div>
            <ChatInput isMessageLoading={inProgressMessage} onSubmit={onSubmit}/>
          </div>
        </div>
        {!!summary?.sources?.length && (
          <>
            <h3 className="text-lg mb-4 font-bold">Sources chunks</h3>
            <div className="">
              {summary?.sources?.map((result) => (
                <div
                  className="bg-white border border-light-fog mb-4 p-4 rounded-xl shadow-md"
                  key={result.name}
                >
                  <div className="flex flex-row space-x-1.5 pb-2">
                    <h4 className="text-md mb-1 font-semibold">
                      {result.url
                        ? <a className="text-dark-blue" href={result?.url}>{result.name}</a>
                        : result.name}
                    </h4>
                  </div>
                  {result.summary?.map((text, index) => (
                    <React.Fragment key={index}>
                      {!!index && <p>...</p>}
                      <p className="text-sm mb-2 text-light-ink">{text}</p>
                    </React.Fragment>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function App() {
  const dispatch = useAppDispatch();
  const isSessionStarted = useAppSelector((state) => state.sessionId);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const loading = useAppSelector((state) => state.loading);

  const onSearch = (query) => {
    dispatch(thunkActions.search(query));
  };

  const suggestedQueries = [
    "What is our work from home policy?",
    "What's the NASA sales team?",
    "Does the company own my personal project?",
    "What job openings do we have?",
    "How does compensation work?",
  ];

  return (
    <>
      <Header/>
      <div className="p-8">
        <div className="max-w-2xl mx-auto">
          <SearchInput
            onSearch={onSearch}
            value={searchQuery}
            searchActive={isSessionStarted}
          />
        </div>

        {!loading && !isSessionStarted && (
          <div className="text-left mt-20 w-96 mx-auto">
            <h1 className="text-xl font-bold mb-4">Ask a question about</h1>
            <div className="flex flex-col space-y-4">
              {suggestedQueries.map((query) => (
                <a
                  key={query}
                  href="#"
                  className="text-lg text-dark-blue hover:text-blue-700"
                  onClick={(e) => {
                    e.preventDefault();
                    setSearchQuery(query);
                    onSearch(query);
                  }}
                >
                  {query}
                </a>
              ))}
            </div>
          </div>
        )}

        {loading && !isSessionStarted && (
          <div className="relative w-24 mx-auto py-10 opacity-30">
            <BeatLoader size={15}/>
          </div>
        )}

        {isSessionStarted && <Results/>}
      </div>
    </>
  );
}

export default App;
