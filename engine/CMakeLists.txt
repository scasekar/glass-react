cmake_minimum_required(VERSION 3.22)
project(glass-engine LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 20)

add_executable(engine
    src/main.cpp
    src/background_engine.cpp
)

if(EMSCRIPTEN)
    set_target_properties(engine PROPERTIES SUFFIX ".js")

    target_compile_options(engine PRIVATE
        "--use-port=emdawnwebgpu"
    )
    target_link_options(engine PRIVATE
        "--use-port=emdawnwebgpu"
        "-sASYNCIFY=1"
        "-sALLOW_MEMORY_GROWTH"
        "-lembind"
        "-sEXPORTED_RUNTIME_METHODS=['ccall']"
        "-sENVIRONMENT=web"
        "-sMODULARIZE=1"
        "-sEXPORT_ES6=1"
        "-sEXPORT_NAME=createEngineModule"
    )
endif()
